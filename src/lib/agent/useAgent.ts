"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Content, Part } from "@google/genai";
import { loadAgentState, saveAgentState, clearAgentState } from "./persist";
import { MODEL_CHAIN } from "./models";

export interface AgentFileContext {
  listFiles: () => string[];
  readFile: (path: string) => Promise<string>;
  runFile: (path: string) => Promise<{ stdout: string; stderr: string; exitCode: number; compileStderr?: string }>;
  /** Current content of a path, or null if it doesn't exist yet — used to build the diff shown for approval. */
  getContent: (path: string) => Promise<string | null>;
  /** Actually writes the file (creating missing folders as needed). Only called after the user approves. */
  applyWrite: (path: string, content: string) => Promise<void>;
  /** Actually deletes the file. Only called after the user approves. */
  applyDelete: (path: string) => Promise<void>;
  /** Runs a shell command in a real Node.js/npm environment (WebContainers) — npm/npx/node only, not Python or other languages. */
  runCommand: (command: string) => Promise<{ stdout: string; exitCode: number; timedOut?: boolean }>;
}

export interface AgentLogEntry {
  id: number;
  kind: "user" | "text" | "tool-call" | "tool-result" | "error";
  text: string;
}

export interface PendingChange {
  id: number;
  kind: "write" | "delete";
  path: string;
  before: string | null;
  after: string | null;
}

const MAX_STEPS = 15;
const LOG_STRING_PREVIEW_LEN = 200;

// The activity log is for skimming what the agent is doing, not for reading
// full file contents — a write_file call for a whole HTML/CSS file would
// otherwise dump hundreds of lines as one unbroken JSON blob into the log.
// The full, untruncated value is still what's actually sent to/used by the
// tool; only the displayed copy is shortened.
function summarizeForLog(value: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value)) {
    if (typeof val === "string" && val.length > LOG_STRING_PREVIEW_LEN) {
      out[key] = `${val.slice(0, LOG_STRING_PREVIEW_LEN)}… (${val.length} chars)`;
    } else {
      out[key] = val;
    }
  }
  return out;
}

// storageKey scopes persistence to one project/folder — e.g. the project id
// in cloud mode, or a folder-derived key in local mode — so switching
// projects shows that project's own conversation, not a mix of everyone's.
function initialLogId(storageKey: string): number {
  const log = loadAgentState(storageKey)?.log ?? [];
  return log.length ? Math.max(...log.map((e) => e.id)) + 1 : 0;
}

export function useAgent(ctx: AgentFileContext, storageKey: string) {
  // useState's lazy initializer runs exactly once, on mount, which is what
  // scopes this read to "once per project" — React remounts this whole page
  // component on project navigation.
  const [log, setLog] = useState<AgentLogEntry[]>(() => loadAgentState(storageKey)?.log ?? []);
  const [running, setRunning] = useState(false);
  const [pending, setPending] = useState<PendingChange[]>([]);
  const [autoApprove, setAutoApprove] = useState(false);

  // useRef's initial-value argument is (re-)evaluated every render but only
  // ever used on the first one, so calling loadAgentState here — a plain
  // function call, not a ref read — is a harmless bit of repeated work, not
  // a re-read of stale data.
  const historyRef = useRef<Content[]>(loadAgentState(storageKey)?.history ?? []);
  const stopRef = useRef(false);
  const logIdRef = useRef(initialLogId(storageKey));
  // Sticks with whichever model last worked (not reset per run()) so a
  // model that just got rate limited isn't retried on the very next task.
  const modelIndexRef = useRef(0);
  // Models that returned 404 (deprecated/renamed) — dropped from rotation
  // for the rest of this session rather than retried every time.
  const deadModelsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    saveAgentState(storageKey, { log, history: historyRef.current });
  }, [log, storageKey]);
  const pendingIdRef = useRef(0);
  const resolversRef = useRef<Map<number, (approved: boolean) => void>>(new Map());
  const autoApproveRef = useRef(autoApprove);
  useEffect(() => {
    autoApproveRef.current = autoApprove;
  });

  const pushLog = useCallback((kind: AgentLogEntry["kind"], text: string) => {
    setLog((prev) => [...prev, { id: logIdRef.current++, kind, text }]);
  }, [setLog]);

  const requestApproval = useCallback((change: Omit<PendingChange, "id">): Promise<boolean> => {
    if (autoApproveRef.current) return Promise.resolve(true);
    const id = pendingIdRef.current++;
    setPending((prev) => [...prev, { ...change, id }]);
    return new Promise<boolean>((resolve) => {
      resolversRef.current.set(id, (approved) => {
        setPending((prev) => prev.filter((c) => c.id !== id));
        resolve(approved);
      });
    });
  }, [setPending]);

  const decide = useCallback((id: number, approved: boolean) => {
    const resolve = resolversRef.current.get(id);
    if (resolve) {
      resolve(approved);
      resolversRef.current.delete(id);
    }
  }, []);

  const callStep = useCallback(
    async (contents: Content[]): Promise<Part[]> => {
      const available = () => MODEL_CHAIN.filter((m) => !deadModelsRef.current.has(m));
      // Two full passes through every live model before truly giving up.
      const maxAttempts = MODEL_CHAIN.length * 2;
      let failuresSinceSuccess = 0;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const models = available();
        if (models.length === 0) throw new Error("No configured Gemini models are available.");
        const model = models[modelIndexRef.current % models.length];

        const switchToNext = (reason: string) => {
          failuresSinceSuccess++;
          const stillAvailable = available();
          modelIndexRef.current++;
          const next = stillAvailable[modelIndexRef.current % stillAvailable.length];
          pushLog("error", `${model} ${reason} — switching to ${next}…`);
        };

        const controller = new AbortController();
        // A single non-streaming Gemini call can legitimately take a while
        // for a large response, but with no bound at all a truly hung
        // request looks identical to "still working" forever. 75s is well
        // past any normal response for this app's task sizes.
        const timeout = setTimeout(() => controller.abort(), 75_000);
        let res: Response;
        try {
          res = await fetch("/api/agent/step", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents, model }),
            signal: controller.signal,
          });
        } catch (e) {
          clearTimeout(timeout);
          if (e instanceof Error && e.name === "AbortError") {
            switchToNext("didn't respond in time");
            continue;
          }
          throw e;
        }
        clearTimeout(timeout);

        if (res.status === 404) {
          // Deprecated/renamed model — pointless to keep rotating into it.
          deadModelsRef.current.add(model);
          pushLog("error", `${model} is no longer available — removed it from rotation.`);
          continue;
        }
        if (res.status === 429 || res.status === 503) {
          switchToNext(res.status === 429 ? "is rate limited" : "is overloaded");
          // Every model in the chain has now failed at least once in this
          // call — pause briefly before looping back around, instead of
          // hammering all of them in a tight loop.
          if (failuresSinceSuccess > 0 && failuresSinceSuccess % available().length === 0) {
            pushLog("error", "All models are busy right now — waiting 8s before trying again…");
            await new Promise((r) => setTimeout(r, 8000));
          }
          continue;
        }

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
        return (data.parts ?? []) as Part[];
      }
      throw new Error("All configured Gemini models are rate-limited or unavailable — try again in a minute.");
    },
    [pushLog]
  );

  const runTool = useCallback(
    async (name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> => {
      try {
        switch (name) {
          case "list_files":
            return { files: ctx.listFiles() };
          case "read_file": {
            const content = await ctx.readFile(String(args.path ?? ""));
            return { content };
          }
          case "run_code": {
            const result = await ctx.runFile(String(args.path ?? ""));
            return { ...result };
          }
          case "run_command": {
            const result = await ctx.runCommand(String(args.command ?? ""));
            return { ...result };
          }
          case "write_file": {
            const path = String(args.path ?? "");
            const content = String(args.content ?? "");
            const before = await ctx.getContent(path);
            const approved = await requestApproval({ kind: "write", path, before, after: content });
            if (!approved) return { error: "The user rejected this change." };
            await ctx.applyWrite(path, content);
            return { ok: true };
          }
          case "delete_file": {
            const path = String(args.path ?? "");
            const before = await ctx.getContent(path);
            if (before === null) return { error: `No file at "${path}".` };
            const approved = await requestApproval({ kind: "delete", path, before, after: null });
            if (!approved) return { error: "The user rejected this change." };
            await ctx.applyDelete(path);
            return { ok: true };
          }
          case "finish":
            return { ok: true };
          default:
            return { error: `Unknown tool "${name}"` };
        }
      } catch (e) {
        return { error: e instanceof Error ? e.message : "Tool failed" };
      }
    },
    [ctx, requestApproval]
  );

  const run = useCallback(
    async (task: string) => {
      stopRef.current = false;
      setRunning(true);
      pushLog("user", task);
      historyRef.current = [...historyRef.current, { role: "user", parts: [{ text: task }] }];

      try {
        for (let step = 0; step < MAX_STEPS; step++) {
          if (stopRef.current) {
            pushLog("error", "Stopped.");
            break;
          }

          const parts = await callStep(historyRef.current);
          historyRef.current = [...historyRef.current, { role: "model", parts }];

          const textParts = parts.filter((p) => p.text).map((p) => p.text as string);
          if (textParts.length) pushLog("text", textParts.join("\n"));

          const calls = parts.filter((p) => p.functionCall).map((p) => p.functionCall!);
          if (calls.length === 0) break; // plain text reply — the model is done for this turn

          let finished = false;
          const responseParts: Part[] = [];
          for (const call of calls) {
            if (stopRef.current) break;
            const name = call.name ?? "";
            const args = (call.args ?? {}) as Record<string, unknown>;
            pushLog("tool-call", `${name}(${JSON.stringify(summarizeForLog(args))})`);
            const result = await runTool(name, args);
            pushLog("tool-result", JSON.stringify(summarizeForLog(result)).slice(0, 800));
            responseParts.push({ functionResponse: { name, response: result } });
            if (name === "finish") finished = true;
          }

          if (stopRef.current) {
            pushLog("error", "Stopped.");
            break;
          }

          historyRef.current = [...historyRef.current, { role: "user", parts: responseParts }];
          if (finished) break;

          if (step === MAX_STEPS - 1) {
            pushLog("error", `Stopped after ${MAX_STEPS} steps — ask a follow-up to continue.`);
          }
        }
      } catch (e) {
        pushLog("error", e instanceof Error ? e.message : "Agent failed");
      } finally {
        setRunning(false);
      }
    },
    [callStep, runTool, pushLog]
  );

  const stop = useCallback(() => {
    stopRef.current = true;
    // Reject every outstanding approval so a paused write/delete doesn't hang forever.
    resolversRef.current.forEach((resolve) => resolve(false));
    resolversRef.current.clear();
    setPending([]);
  }, [setPending]);

  const reset = useCallback(() => {
    historyRef.current = [];
    setLog([]);
    clearAgentState(storageKey);
  }, [storageKey, setLog]);

  return { log, running, run, stop, reset, pending, decide, autoApprove, setAutoApprove };
}
