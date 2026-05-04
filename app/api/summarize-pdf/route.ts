// POST /api/summarize-pdf
// Accepts: multipart/form-data with `file` (a PDF) + optional length/language fields
// Returns: { summary } or { error }
//
// Uses `unpdf` for serverless-friendly PDF text extraction.

import { NextRequest, NextResponse } from "next/server";
import { extractText, getDocumentProxy } from "unpdf";
import { rateLimit } from "@/lib/rateLimit";
import { summarizeText } from "@/lib/openai";

// 4MB cap. Vercel hobby tier limits request body to ~4.5MB so we stay under.
const MAX_FILE_SIZE = 4 * 1024 * 1024;
// Cap the text we send to OpenAI to keep API costs predictable.
const MAX_CHARS_TO_SUMMARIZE = 60000; // ~10k words / ~15k tokens

export async function POST(req: NextRequest) {
  // Rate limit
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const limit = rateLimit(ip, 10, 60 * 60 * 1000); // 10/hr — PDFs are heavier
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a bit and try again." },
      { status: 429 }
    );
  }

  // Parse form data
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Invalid form data." },
      { status: 400 }
    );
  }

  const file = form.get("file");
  const length = (form.get("length") as string) || "medium";
  const language = (form.get("language") as string) || "English";

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Please upload a PDF file." },
      { status: 400 }
    );
  }

  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json(
      { error: "Only PDF files are supported." },
      { status: 400 }
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: `File is too large. Max size is ${MAX_FILE_SIZE / 1024 / 1024}MB.` },
      { status: 400 }
    );
  }

  // Extract text from PDF
  let text: string;
  try {
    const buffer = await file.arrayBuffer();
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const result = await extractText(pdf, { mergePages: true });
    text = (result.text || "").trim();
  } catch (err) {
    console.error("PDF extract error:", err);
    return NextResponse.json(
      { error: "Could not read this PDF. It may be scanned, encrypted, or corrupted." },
      { status: 400 }
    );
  }

  if (text.length < 50) {
    return NextResponse.json(
      { error: "Could not extract enough text from the PDF. Is it a scanned image? OCR isn't supported on the free tier yet." },
      { status: 400 }
    );
  }

  // Truncate if needed (front-load: keeps intro + table of contents)
  const truncated = text.length > MAX_CHARS_TO_SUMMARIZE;
  const textToSend = truncated ? text.slice(0, MAX_CHARS_TO_SUMMARIZE) : text;

  // Summarize
  try {
    const summary = await summarizeText({ text: textToSend, length, language });
    return NextResponse.json({
      summary,
      meta: {
        fileName: file.name,
        sizeKb: Math.round(file.size / 1024),
        charsExtracted: text.length,
        truncated,
      },
    });
  } catch (err) {
    console.error("PDF summarize error:", err);
    return NextResponse.json(
      { error: "AI service error. Please try again in a moment." },
      { status: 500 }
    );
  }
}
