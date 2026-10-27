// App configuration — OpenRouter API key and model for LLM conversations.
//
// The key is read from the environment first so a real credential can be
// supplied without editing tracked code (`.env.local`, or Settings → Secrets).
// The built-in default is kept as a fallback so behaviour is unchanged when
// nothing is set. Imported only by `src/app/api/llm/route.ts`, which runs on
// the server, so neither value reaches the browser bundle.
export const OPENROUTER_API_KEY =
  process.env.OPENROUTER_API_KEY ||
  "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";
export const OPENROUTER_MODEL =
  process.env.OPENROUTER_MODEL || "openrouter/free";
