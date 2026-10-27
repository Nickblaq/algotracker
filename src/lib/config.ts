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
