import { NextRequest, NextResponse } from "next/server";
import { ApiError, GoogleGenAI, type Content } from "@google/genai";
import { AGENT_TOOLS } from "@/lib/agent/tools";
import { MODEL_CHAIN } from "@/lib/agent/models";

export const dynamic = "force-dynamic";

// The SDK's ApiError.message is sometimes the raw JSON response body
// (`{"error":{"message":"...","status":"..."}}`) rather than plain text —
// unwrap it so the client shows a readable string instead of a JSON blob.
function extractMessage(raw: string): string {
  try {
    const parsed = JSON.parse(raw);
    return parsed?.error?.message ?? raw;
  } catch {
    return raw;
  }
}

const SYSTEM_PROMPT = `You are a coding agent embedded in a browser-based IDE. You can inspect the user's project, run code, and propose file changes using the tools provided.

Rules:
- Always call list_files first if you don't already know what's in the project.
- Read a file with read_file before editing it or making claims about its contents.
- write_file and delete_file are staged, not immediate — the user reviews a diff and can reject the change, so a "rejected" tool result means you must stop that particular edit and can ask the user what they want instead, not silently retry the same write.
- write_file always takes the complete new file content, never a diff or partial patch.
- Use run_code after an edit to verify it actually works, when that's practical.
- run_command runs real npm/node/npx commands (installs, scaffolding, builds) — it is Node.js only, never for Python or other languages, and it times out after ~20s, so don't use it to wait on a dev server; start it and move on, the preview picks up the URL separately once the server is ready.
- Be concise — this is a small IDE project, not a large codebase.
- Call finish only when the task is genuinely done, with a short summary. Don't call finish to ask a question — just respond with text instead.`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY is not set on the server. Add it to .env.local and restart the dev server." },
      { status: 500 }
    );
  }

  const body = await req.json();
  const contents = body?.contents as Content[] | undefined;
  if (!Array.isArray(contents) || contents.length === 0) {
    return NextResponse.json({ error: "contents must be a non-empty array" }, { status: 400 });
  }

  // The client picks which model to try (it's the one tracking the rotation
  // across a rate-limited/overloaded model) — only accept one from the known
  // chain, never an arbitrary client-supplied string.
  const requestedModel = typeof body?.model === "string" ? body.model : undefined;
  const model = requestedModel && MODEL_CHAIN.includes(requestedModel) ? requestedModel : MODEL_CHAIN[0];

  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        tools: [{ functionDeclarations: AGENT_TOOLS }],
      },
    });

    const parts = response.candidates?.[0]?.content?.parts ?? [];
    return NextResponse.json({ parts, model });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: extractMessage(err.message) }, { status: err.status });
    }
    return NextResponse.json(
      { error: err instanceof Error ? extractMessage(err.message) : "Gemini request failed" },
      { status: 502 }
    );
  }
}
