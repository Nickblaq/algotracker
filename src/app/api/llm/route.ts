import { NextResponse } from 'next/server';

interface LlmRequestBody {
  system: string;
  messages: Array<{ role: string; content: string }>;
}

export async function POST(req: Request) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'OPENROUTER_API_KEY is not set on the server' },
      { status: 500 },
    );
  }

  let body: LlmRequestBody;
  try {
    body = (await req.json()) as LlmRequestBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL ?? 'openrouter/free',
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
