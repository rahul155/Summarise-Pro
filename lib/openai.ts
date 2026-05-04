// Shared OpenAI client + summarizer helper.
// Centralizing this means all routes share the same key + the same prompt,
// and you can swap the model in one place if you ever change providers.

import OpenAI from "openai";

if (!process.env.OPENAI_API_KEY) {
  // Don't throw at import time (it crashes the whole route file).
  // Just warn so misconfiguration is visible in the dev terminal.
  console.warn("[summapro] OPENAI_API_KEY is not set. Add it to .env.local.");
}

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "missing",
});

// Pick your default model in ONE place. Swap to "gpt-4o-mini" if your account
// doesn't have access to gpt-4.1-nano yet — both are cheap and good for
// summarization.
export const DEFAULT_MODEL = "gpt-4.1-nano";

const LENGTH_INSTRUCTIONS: Record<string, string> = {
  short: "in 2-3 sentences",
  medium: "in 1 well-structured paragraph (5-7 sentences)",
  long: "in 3-4 paragraphs with clear structure",
};

export async function summarizeText(opts: {
  text: string;
  length?: string;
  language?: string;
}) {
  const length = opts.length || "medium";
  const language = opts.language || "English";

  const completion = await openai.chat.completions.create({
    model: DEFAULT_MODEL,
    messages: [
      {
        role: "system",
        content: `You are a precise text summarizer. Summarize the user's text ${LENGTH_INSTRUCTIONS[length] || LENGTH_INSTRUCTIONS.medium} in ${language}. Preserve key facts, names, numbers, and dates. Do not invent information. Return only the summary, no preamble.`,
      },
      { role: "user", content: opts.text },
    ],
    temperature: 0.3,
  });

  return completion.choices[0]?.message?.content?.trim() || "";
}
