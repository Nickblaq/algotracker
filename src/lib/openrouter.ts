const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMResponse {
  content: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/** Store/retrieve API key from localStorage */
export function getApiKey(): string {
  return localStorage.getItem("openrouter_api_key") ?? "";
}

export function setApiKey(key: string): void {
  localStorage.setItem("openrouter_api_key", key);
}

export function getSelectedModel(): string {
  return (
    localStorage.getItem("openrouter_model") ?? "anthropic/claude-sonnet-4-20250514"
  );
}

export function setSelectedModel(model: string): void {
  localStorage.setItem("openrouter_model", model);
}

export const AVAILABLE_MODELS = [
  { id: "anthropic/claude-sonnet-4-20250514", name: "Claude Sonnet 4" },
  { id: "anthropic/claude-3.5-haiku-20241022", name: "Claude 3.5 Haiku" },
  { id: "openai/gpt-4o-mini", name: "GPT-4o Mini" },
  { id: "openai/gpt-4o", name: "GPT-4o" },
  { id: "google/gemini-2.0-flash-001", name: "Gemini 2.0 Flash" },
  { id: "meta-llama/llama-3.1-8b-instruct:free", name: "Llama 3.1 8B (Free)" },
  { id: "deepseek/deepseek-chat", name: "DeepSeek Chat" },
] as const;

/**
 * Send a chat completion request to OpenRouter.
 * Falls back gracefully if the API key is not set.
 */
export async function chatCompletion(
  messages: ChatMessage[],
  options: {
    maxTokens?: number;
    temperature?: number;
  } = {},
): Promise<LLMResponse> {
  const apiKey = getApiKey();
  const model = getSelectedModel();

  if (!apiKey) {
    throw new Error(
      "OpenRouter API key not configured. Click the gear icon to set it.",
    );
  }

  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": window.location.origin,
      "X-Title": "MemoryLM - Hierarchical Memory for LLMs",
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: options.maxTokens ?? 2048,
      temperature: options.temperature ?? 0.7,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    let errorMsg = `OpenRouter API error (${response.status})`;
    try {
      const parsed = JSON.parse(errorBody);
      errorMsg = parsed.error?.message ?? errorMsg;
    } catch {
      // use default
    }
    throw new Error(errorMsg);
  }

  const data = await response.json();
  const choice = data.choices?.[0];

  return {
    content: choice?.message?.content ?? "",
    model: data.model ?? model,
    usage: {
      promptTokens: data.usage?.prompt_tokens ?? 0,
      completionTokens: data.usage?.completion_tokens ?? 0,
      totalTokens: data.usage?.total_tokens ?? 0,
    },
  };
}
