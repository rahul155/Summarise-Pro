import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SummaPro - Free AI Summarizer & Paraphraser",
  description: "Summarize text, PDFs, and articles in seconds. Free AI summarization tool with paraphrasing in 7 modes.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Google AdSense - uncomment after AdSense approval, replace ca-pub-XXXX with your publisher ID */}
        {/* <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXXXXXXX" crossOrigin="anonymous"></script> */}
      </head>
      <body>{children}</body>
    </html>
  );
}
