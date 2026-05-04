"use client";
import { useRef, useState } from "react";

type Tab = "text" | "pdf" | "url" | "paraphrase";

export default function Home() {
  const [tab, setTab] = useState<Tab>("text");
  const [textInput, setTextInput] = useState("");
  const [paraInput, setParaInput] = useState("");
  const [url, setUrl] = useState("");
  const [pdf, setPdf] = useState<File | null>(null);
  const [length, setLength] = useState("medium");
  const [language, setLanguage] = useState("English");
  const [mode, setMode] = useState("standard");
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function run() {
    setError(""); setOutput(""); setLoading(true);
    try {
      let res: Response;
      if (tab === "text") {
        res = await fetch("/api/summarize", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: textInput, length, language }) });
      } else if (tab === "paraphrase") {
        res = await fetch("/api/paraphrase", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: paraInput, mode }) });
      } else if (tab === "url") {
        res = await fetch("/api/summarize-url", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url, length, language }) });
      } else {
        if (!pdf) throw new Error("Choose a PDF file.");
        const fd = new FormData();
        fd.append("file", pdf); fd.append("length", length); fd.append("language", language);
        res = await fetch("/api/summarize-pdf", { method: "POST", body: fd });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setOutput(data.summary || data.output || "");
    } catch (e: any) { setError(e.message || "Network error"); }
    finally { setLoading(false); }
  }

  function copy() { navigator.clipboard.writeText(output); }

  const TABS: { id: Tab; label: string }[] = [
    { id: "text", label: "Text" },
    { id: "pdf", label: "PDF" },
    { id: "url", label: "Article URL" },
    { id: "paraphrase", label: "Paraphrase" },
  ];

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <header className="border-b bg-white">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold shadow-sm">S</div>
            <span className="font-bold text-xl text-slate-900">SummaPro</span>
          </div>
          <nav className="text-sm text-slate-600 hidden sm:block">Free AI tools</nav>
        </div>
      </header>

      <section className="max-w-3xl mx-auto px-6 pt-12 pb-4 text-center">
        <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-3 tracking-tight">Summarize anything in seconds</h1>
        <p className="text-slate-600 text-lg">AI-powered summaries for text, PDFs, articles, and more. No sign-up needed.</p>
      </section>

      {/* AD SLOT - Top banner. AdSense code goes here. The "empty:hidden" class collapses the div until ads load, so there is no empty space. */}
      <div id="ad-slot-top" className="max-w-3xl mx-auto px-6 empty:hidden"></div>

      <section className="max-w-3xl mx-auto px-6 pb-8">
        <div className="bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden">
          <div className="flex border-b border-slate-200 overflow-x-auto">
            {TABS.map((t) => (
              <button key={t.id} onClick={() => { setTab(t.id); setOutput(""); setError(""); }} className={`flex-1 min-w-fit py-3.5 px-5 text-sm font-medium transition whitespace-nowrap ${tab === t.id ? "bg-blue-50 text-blue-700 border-b-2 border-blue-600" : "text-slate-600 hover:bg-slate-50"}`}>{t.label}</button>
            ))}
          </div>

          <div className="p-6">
            {tab === "text" && (
              <textarea value={textInput} onChange={(e) => setTextInput(e.target.value)} placeholder="Paste an article, essay, or any long text here..." className="w-full h-56 border border-slate-300 rounded-lg p-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            )}
            {tab === "paraphrase" && (
              <>
                <label className="block text-xs font-medium text-slate-600 mb-1">Mode</label>
                <select value={mode} onChange={(e) => setMode(e.target.value)} className="border border-slate-300 rounded-md px-3 py-2 text-sm mb-3 bg-white">
                  <option value="standard">Standard</option><option value="fluency">Fluency</option><option value="formal">Formal</option><option value="academic">Academic</option><option value="creative">Creative</option><option value="shorten">Shorten</option><option value="expand">Expand</option>
                </select>
                <textarea value={paraInput} onChange={(e) => setParaInput(e.target.value)} placeholder="Paste text to rewrite..." className="w-full h-56 border border-slate-300 rounded-lg p-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </>
            )}
            {tab === "url" && (
              <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://en.wikipedia.org/wiki/Artificial_intelligence" className="w-full border border-slate-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            )}
            {tab === "pdf" && (
              <div onClick={() => fileRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) setPdf(f); }} className="border-2 border-dashed border-slate-300 rounded-lg p-10 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50/40 transition">
                <input ref={fileRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => setPdf(e.target.files?.[0] || null)} />
                <div className="text-3xl mb-2">PDF</div>
                {pdf ? (<><div className="font-medium text-slate-900">{pdf.name}</div><div className="text-xs text-slate-500 mt-1">{(pdf.size / 1024).toFixed(0)} KB - click to change</div></>) : (<><div className="font-medium text-slate-900">Drop a PDF or click to upload</div><div className="text-xs text-slate-500 mt-1">Max 4 MB</div></>)}
              </div>
            )}

            {tab !== "paraphrase" && (
              <div className="flex flex-wrap gap-3 mt-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Length</label>
                  <select value={length} onChange={(e) => setLength(e.target.value)} className="border border-slate-300 rounded-md px-3 py-2 text-sm bg-white">
                    <option value="short">Short</option><option value="medium">Medium</option><option value="long">Long</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Language</label>
                  <select value={language} onChange={(e) => setLanguage(e.target.value)} className="border border-slate-300 rounded-md px-3 py-2 text-sm bg-white">
                    {["English","Spanish","French","German","Portuguese","Italian","Hindi","Arabic","Chinese","Japanese"].map(l => <option key={l}>{l}</option>)}
                  </select>
                </div>
              </div>
            )}

            <button onClick={run} disabled={loading} className="mt-5 w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-semibold py-3.5 rounded-lg transition shadow-sm">
              {loading ? "Working..." : tab === "paraphrase" ? "Paraphrase" : "Summarize"}
            </button>

            {error && <div className="mt-3 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>}

            {output && (
              <div className="mt-6 p-5 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="flex justify-between items-center mb-3">
                  <strong className="text-sm text-slate-700">{tab === "paraphrase" ? "Result" : "Summary"}</strong>
                  <button onClick={copy} className="text-xs px-3 py-1 border border-slate-300 rounded hover:bg-white bg-white">Copy</button>
                </div>
                <p className="text-slate-800 whitespace-pre-wrap leading-relaxed">{output}</p>
              </div>
            )}
          </div>
        </div>

        {/* AD SLOT - Below output. AdSense code goes here. */}
        {output && (<div id="ad-slot-bottom" className="mt-6 empty:hidden"></div>)}

        <div className="grid md:grid-cols-3 gap-4 mt-10 text-center">
          <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="font-semibold text-slate-900 mb-1">Lightning fast</div>
            <p className="text-sm text-slate-600">Summaries in 3-5 seconds.</p>
          </div>
          <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="font-semibold text-slate-900 mb-1">4 input types</div>
            <p className="text-sm text-slate-600">Text, PDF, URL, paraphrase.</p>
          </div>
          <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="font-semibold text-slate-900 mb-1">10+ languages</div>
            <p className="text-sm text-slate-600">Summarize in your language.</p>
          </div>
        </div>
      </section>

      <footer className="border-t bg-white py-6 text-center text-sm text-slate-500">
        Built with Next.js + OpenAI
      </footer>
    </main>
  );
}

