import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { rateLimit } from "@/lib/rateLimit";
import { summarizeText } from "@/lib/openai";

const FETCH_TIMEOUT_MS = 10000;
const MAX_HTML_BYTES = 2 * 1024 * 1024;
const MAX_CHARS_TO_SUMMARIZE = 60000;

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const limit = rateLimit(ip, 20, 60 * 60 * 1000);
  if (!limit.ok) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  let body: { url?: string; length?: string; language?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const url = (body.url || "").trim();
  const length = body.length || "medium";
  const language = body.language || "English";

  let parsed: URL;
  try {
    parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("bad");
  } catch {
    return NextResponse.json({ error: "Please enter a valid http(s) URL." }, { status: 400 });
  }

  const host = parsed.hostname.toLowerCase();
  if (host === "localhost" || host.startsWith("127.") || host.startsWith("10.") || host.startsWith("192.168.") || host.endsWith(".local")) {
    return NextResponse.json({ error: "Private and local URLs are not allowed." }, { status: 400 });
  }

  let html: string;
  let pageTitle = "";
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(url, { signal: controller.signal, headers: { "User-Agent": "SummaPro/1.0", Accept: "text/html" }, redirect: "follow" });
    clearTimeout(t);
    if (!res.ok) return NextResponse.json({ error: `URL returned ${res.status}.` }, { status: 400 });
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("text/html") && !ct.includes("application/xhtml")) {
      return NextResponse.json({ error: "URL did not return an HTML page." }, { status: 400 });
    }
    const buffer = await res.arrayBuffer();
    if (buffer.byteLength > MAX_HTML_BYTES) {
      html = new TextDecoder("utf-8", { fatal: false }).decode(buffer.slice(0, MAX_HTML_BYTES));
    } else {
      html = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
    }
  } catch (err: any) {
    if (err?.name === "AbortError") {
      return NextResponse.json({ error: "URL took too long to load." }, { status: 408 });
    }
    return NextResponse.json({ error: "Could not fetch the URL." }, { status: 400 });
  }

  const $ = cheerio.load(html);
  pageTitle = $("title").first().text().trim() || $("h1").first().text().trim() || url;
  $("script, style, noscript, nav, header, footer, aside, iframe, svg, form, button").remove();

  let text = "";
  const candidates = ["article", "main", "[role=main]", ".article", ".post", ".content", "#content", "#main"];
  for (const sel of candidates) {
    const el = $(sel).first();
    if (el.length) {
      text = el.text();
      if (text.trim().length > 200) break;
    }
  }
  if (text.trim().length < 200) text = $("body").text();
  text = text.replace(/\s+/g, " ").trim();

  if (text.length < 100) {
    return NextResponse.json({ error: "Could not find readable content on this page." }, { status: 400 });
  }

  const truncated = text.length > MAX_CHARS_TO_SUMMARIZE;
  const textToSend = truncated ? text.slice(0, MAX_CHARS_TO_SUMMARIZE) : text;

  try {
    const summary = await summarizeText({ text: textToSend, length, language });
    return NextResponse.json({ summary, meta: { title: pageTitle, url, chars: text.length, truncated } });
  } catch (err) {
    console.error("URL summarize error:", err);
    return NextResponse.json({ error: "AI service error." }, { status: 500 });
  }
}
