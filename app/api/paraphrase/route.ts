import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { openai, DEFAULT_MODEL } from "@/lib/openai";

const MODES: Record<string, string> = {
  standard: "Rewrite the text naturally, preserving the original meaning.",
  fluency: "Rewrite for maximum fluency, smoothness, and clarity. Fix any awkward phrasing.",
  formal: "Rewrite in a formal, professional tone suitable for business communication.",
  academic: "Rewrite in an academic style with precise vocabulary and complex sentence structures.",
  creative: "Rewrite creatively with vivid, engaging, and varied language while keeping meaning intact.",
  shorten: "Rewrite as concisely as possible without losing essential meaning.",
  expand: "Rewrite with more detail, supporting examples, and elaboration.",
};

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const limit = rateLimit(ip);
  if (!limit.ok) {
    return NextResponse.json({ error: "Too many requests. Please wait a bit and try again." }, { status: 429 });
  }

  let body: { text?: string; mode?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const text = (body.text || "").trim();
  const mode = body.mode || "standard";

  if (text.length < 50) {
    return NextResponse.json({ error: "Please provide at least 50 characters of text." }, { status: 400 });
  }
  if (text.length > 15000) {
    return NextResponse.json({ error: "Text is too long. Free tier max is ~2,500 words." }, { status: 400 });
  }

  const instruction = MODES[mode] || MODES.standard;

  try {
    const completion = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [
        { role: "system", content: `You are a paraphrasing assistant. ${instruction} Return only the rewritten text, no preamble or explanation.` },
        { role: "user", content: text },
      ],
      temperature: 0.7,
    });
    const output = completion.choices[0]?.message?.content?.trim() || "";
    return NextResponse.json({ output });
  } catch (err: any) {
    console.error("Paraphrase error:", err);
    return NextResponse.json({ error: "AI service error. Please try again in a moment." }, { status: 500 });
  }
}
