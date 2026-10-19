import { NextResponse } from 'next/server';
import { OPENROUTER_API_KEY, OPENROUTER_MODEL } from '@/lib/config';

/**
 * OpenRouter proxy for assistant replies.
 *
 * Credentials live in `src/lib/config.ts` so the key and model are changed in
 * one place. This module is server-only, so the key never reaches the browser
 * bundle — do not import the config from a client component.
 */
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
