// Free-tier Gemini quota is per-model, not shared across the whole account —
// so when one model gets rate limited, a different model is usually
// immediately available. This is the rotation order the agent works through;
// each entry is a distinct model (not just an alias for one already listed),
// since an alias and the model it currently resolves to can share the same
// quota bucket. Source: https://ai.google.dev/gemini-api/docs/models
export const MODEL_CHAIN: string[] = [
  "gemini-2.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash-lite",
  "gemini-3.6-flash",
  "gemini-2.5-flash",
  "gemini-3.5-flash",
];
