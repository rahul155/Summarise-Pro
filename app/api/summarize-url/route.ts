// POST /api/summarize-url
// Body: { url, length?, language? }
// Returns: { summary, meta: { title, url } } or { error }
//
// Fetches the URL, extracts the main text content with cheerio,
// then summarizes it.

import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { rateLimit } from "@/lib/rateLimit";
import { summarizeText } from "@/lib/openai";

const FETCH_TIMEOUT_MS = 10000;
const MAX_HTML_BYTES = 2 * 1024 * 1024; // 2MB
const MAX_CHARS_TO_SUMMARIZE = 60000;

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const limit = rateLimit(ip, 20, 60 * 60 * 1000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please wait and try again." },
      { status: 429 }
    );
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

  // Validate URL
  let parsed: URL;
  try {
    parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("bad protocol");
    }
  } catch {
    return NextResponse.json(
      { error: "Please enter a valid http(s) URL." },
      { status: 400 }
    );
  }

  // Block private network requests (basic SSRF protection)
  // — full SSRF protection requires DNS resolution checks; this is the
  // minimum safety net for a public-facing tool.
  const host = parsed.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.startsWith("127.") ||
    host.startsWith("10.") ||
    host.startsWith("192.168.") ||
    host.endsWith(".local") ||
    host === "0.0.0.0"
  ) {
    return NextResponse.json(
      { error: "Private and local URLs are not allowed." },
      { status: 400 }
    );
  }

  // Fetch with timeout
  let html: string;
  let pageTitle = "";
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "SummaPro/1.0 (+https://summapro.app/bot) AI summarizer fetcher",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      return NextResponse.json(
        { error: `URL returned ${res.status}. Try a different page.` },
        { status: 400 }
      );
    }

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      return NextResponse.json(
        { error: "URL did not return an HTML page." },
        { status: 400 }
      );
    }

    // Cap by reading limited bytes
    const reader = res.body?.getReader();
    if (!reader) throw new Error("No response body");

    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_HTML_BYTES) {
        try { await reader.cancel(); } catch {}
        break;
      }
      chunks.push(value);
    }
    const merged = new Uint8Array(totalBytes);
    let offset = 0;
    for (const c of chunks) {
      merged.set(c, offset);
      offset += c.byteLength;
    }
    html = new TextDecoder("utf-8", { fatal: false }).decode(merged);
  } catch (err: any) {
    console.error("URL fetch error:", err);
    if (err?.name === "AbortError") {
      return NextResponse.json(
        { error: "URL took too long to load (10s timeout)." },
        { status: 408 }
      );
    }
    return NextResponse.json(
      { error: "Could not fetch the URL. Check the address and try again." },
      { status: 400 }
    );
  }

  // Extract main content
  const $ = cheerio.load(html);
  pageTitle = $("title").first().text().trim() || $("h1").first().text().trim() || url;

  // Strip noise
  $("script, style, noscript, nav, header, footer, aside, iframe, svg, form, button").remove();

  // Try common article containers first; fall back to body
  let text = "";
  const candidates = ["article", "main", "[role=main]", ".article", ".post", ".content", "#content", "#main"];
  for (const sel of candidates) {
    const el = $(sel).first();
    if (el.length) {
      text = el.text();
      if (text.trim().length > 200) break;
    }
  }
  if (text.trim().length < 200) {
    text = $("body").text();
  }

  // Clean whitespace
  text = text.replace(/\s+/g, " ").trim();

  if (text.length < 100) {
    return NextResponse.json(
      { error: "Could not find readable content on this page. It may require JavaScript to load." },
      { status: 400 }
    );
  }

  const truncated = text.length > MAX_CHARS_TO_SUMMARIZE;
  const textToSend = truncated ? text.slice(0, MAX_CHARS_TO_SUMMARIZE) : text;

  try {
    const summary = await summarizeText({ text: textToSend, length, language });
    return NextResponse.json({
      summary,
      meta: {
        title: pageTitle,
        url,
        chars: text.length,
        truncated,
      },
    });
  } catch (err) {
    console.error("URL summarize error:", err);
    return NextResponse.json(
      { error: "AI service error. Please try again." },
      { status: 500 }
    );
  }
}
