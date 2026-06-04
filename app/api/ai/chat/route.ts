import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { messages, system } = await req.json();

  const kimiRes = await fetch("https://api.kimi.com/coding/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.KIMI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "moonshot-v1-8k",
      messages: [
        ...(system ? [{ role: "system", content: system }] : []),
        ...messages,
      ],
      temperature: 0.7,
    }),
  });

  if (!kimiRes.ok) {
    const err = await kimiRes.text();
    return NextResponse.json({ error: err }, { status: kimiRes.status });
  }

  const data = await kimiRes.json();
  const reply = data.choices?.[0]?.message?.content ?? "";
  return NextResponse.json({ reply });
}
