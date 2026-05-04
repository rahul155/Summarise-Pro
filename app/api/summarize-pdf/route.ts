import { NextRequest, NextResponse } from "next/server";
import { extractText, getDocumentProxy } from "unpdf";
import { rateLimit } from "@/lib/rateLimit";
import { summarizeText } from "@/lib/openai";

const MAX_FILE_SIZE = 4 * 1024 * 1024;
const MAX_CHARS_TO_SUMMARIZE = 60000;

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const limit = rateLimit(ip, 10, 60 * 60 * 1000);
  if (!limit.ok) {
    return NextResponse.json({ error: "Too many requests. Please wait." }, { status: 429 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const file = form.get("file");
  const length = (form.get("length") as string) || "medium";
  const language = (form.get("language") as string) || "English";

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Please upload a PDF file." }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File is too large. Max 4 MB." }, { status: 400 });
  }

  let text: string;
  try {
    const buffer = await file.arrayBuffer();
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const result = await extractText(pdf, { mergePages: true });
    text = (result.text || "").trim();
  } catch (err) {
    console.error("PDF extract error:", err);
    return NextResponse.json({ error: "Could not read this PDF. It may be scanned or encrypted." }, { status: 400 });
  }

  if (text.length < 50) {
    return NextResponse.json({ error: "Could not extract enough text from the PDF." }, { status: 400 });
  }

  const truncated = text.length > MAX_CHARS_TO_SUMMARIZE;
  const textToSend = truncated ? text.slice(0, MAX_CHARS_TO_SUMMARIZE) : text;

  try {
    const summary = await summarizeText({ text: textToSend, length, language });
    return NextResponse.json({ summary, meta: { fileName: file.name, sizeKb: Math.round(file.size / 1024), charsExtracted: text.length, truncated } });
  } catch (err) {
    console.error("PDF summarize error:", err);
    return NextResponse.json({ error: "AI service error." }, { status: 500 });
  }
}
