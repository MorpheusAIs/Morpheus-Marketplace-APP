"use client";

import { useMemo, useState } from "react";
import { Copy, Check } from "lucide-react";
import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import python from "highlight.js/lib/languages/python";
import typescript from "highlight.js/lib/languages/typescript";
import "highlight.js/styles/github-dark.css";
import { cn } from "@/lib/utils";

hljs.registerLanguage("bash", bash);
hljs.registerLanguage("python", python);
hljs.registerLanguage("typescript", typescript);

type Lang = "curl" | "python" | "typescript";

interface QuickStartProps {
  baseUrl: string;
}

function snippetFor(lang: Lang, baseUrl: string): string {
  const url = `${baseUrl}/chat/completions`;
  const example =
    '{"model":"alt-glm-5","messages":[{"role":"user","content":"Hello"}]}';
  if (lang === "curl") {
    return `curl ${url} \\
  -H "Authorization: Bearer $MORPHEUS_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '${example}'`;
  }
  if (lang === "python") {
    return `from openai import OpenAI

client = OpenAI(
    base_url="${baseUrl}",
    api_key=os.environ["MORPHEUS_API_KEY"],
)

response = client.chat.completions.create(
    model="alt-glm-5",
    messages=[{"role": "user", "content": "Hello"}],
)

print(response.choices[0].message.content)`;
  }
  return `import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "${baseUrl}",
  apiKey: process.env.MORPHEUS_API_KEY,
});

const response = await client.chat.completions.create({
  model: "alt-glm-5",
  messages: [{ role: "user", content: "Hello" }],
});

console.log(response.choices[0].message.content);`;
}

export function QuickStart({ baseUrl }: QuickStartProps) {
  const [lang, setLang] = useState<Lang>("curl");
  const [copied, setCopied] = useState(false);
  const snippet = useMemo(() => snippetFor(lang, baseUrl), [lang, baseUrl]);
  const hljsLang = lang === "curl" ? "bash" : lang;

  const html = useMemo(() => {
    try {
      return hljs.highlight(snippet, { language: hljsLang, ignoreIllegals: true }).value;
    } catch {
      return hljs.highlightAuto(snippet).value;
    }
  }, [snippet, hljsLang]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="rounded border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">
          Quick start · {lang === "curl" ? "cURL" : lang === "python" ? "Python" : "TypeScript"}
        </span>
        <div className="flex items-center gap-1">
          {(["curl", "python", "typescript"] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              className={cn(
                "text-xs px-2 py-0.5 rounded transition-colors",
                lang === l
                  ? "bg-primary/10 text-primary border border-primary/40"
                  : "text-muted-foreground hover:text-foreground border border-transparent",
              )}
            >
              {l === "curl" ? "curl" : l === "python" ? "python" : "typescript"}
            </button>
          ))}
        </div>
      </div>
      <div className="relative">
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy snippet"
          className="absolute top-2 right-2 inline-flex items-center justify-center h-7 w-7 rounded border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-primary/10 transition-colors"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-primary" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </button>
        <pre className="text-xs font-mono whitespace-pre overflow-x-auto pr-10">
          <code
            className={`hljs language-${hljsLang}`}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </pre>
      </div>
    </div>
  );
}
