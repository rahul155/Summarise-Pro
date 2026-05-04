import OpenAI from "openai";

if (!process.env.OPENAI_API_KEY) {
  console.warn("[summapro] OPENAI_API_KEY is not set.");
}

export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "missing" });

export const DEFAULT_MODEL = "gpt-4.1-nano";

const LENGTH_INSTRUCTIONS: Record<string, string> = {
  short: "in 2-3 sentences",
  medium: "in 1 well-structured paragraph (5-7 sentences)",
  long: "in 3-4 paragraphs with clear structure",
};

export async function summarizeText(opts: { text: string; length?: string; language?: string }) {
  const length = opts.length || "medium";
  const language = opts.language || "English";

  const completion = await openai.chat.completions.create({
    model: DEFAULT_MODEL,
    messages: [
      { role: "system", content: `You are a precise text summarizer. Summarize the user text ${LENGTH_INSTRUCTIONS[length] || LENGTH_INSTRUCTIONS.medium} in ${language}. Preserve key facts, names, numbers, and dates. Return only the summary, no preamble.` },
      { role: "user", content: opts.text },
    ],
    temperature: 0.3,
  });

  return completion.choices[0]?.message?.content?.trim() || "";
}
