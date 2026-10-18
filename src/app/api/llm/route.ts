import { NextResponse } from 'next/server';

/**
 * OpenRouter credentials for the assistant replies.
 *
 * This module is server-only, so the key never reaches the browser bundle.
 * It is the single place in the app that talks to the model provider.
 */
const OPENROUTER_API_KEY = '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';
const OPENROUTER_MODEL = 'openrouter/free';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

interface LlmRequestBody {
  system: string;
  messages: Array<{ role: string; content: string }>;
}

export async function POST(req: Request) {
  let body: LlmRequestBody;
  try {
    body = (await req.json()) as LlmRequestBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: [
        { role: 'system', content: body.system },
        ...(body.messages ?? []),
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    return NextResponse.json(
      { error: `OpenRouter ${res.status}: ${detail.slice(0, 300)}` },
      { status: 502 },
    );
  }

  const data = await res.json();
  const content: string = data.choices?.[0]?.message?.content ?? '';
  return NextResponse.json({ content });
}
