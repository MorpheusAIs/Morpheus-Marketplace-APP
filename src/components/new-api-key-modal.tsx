"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";
import { DOC_URLS } from "@/lib/api/config";

interface NewApiKeyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  apiKey: string;
  keyName?: string;
}

function shortenKey(key: string): string {
  if (key.length <= 18) return key;
  return `${key.slice(0, 16)}…${key.slice(-4)}`;
}

export function NewApiKeyModal({
  open,
  onOpenChange,
  apiKey,
  keyName,
}: NewApiKeyModalProps) {
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedEnv, setCopiedEnv] = useState(false);

  // Strip subdomain prefixes like "dev." so the user copies a clean
  // production-shaped URL into their .env.
  // Strip non-prod subdomain prefixes (dev., staging., etc.) so the
  // copied .env shows a clean production-shaped host.
  const baseUrl = DOC_URLS.baseAPI().replace(
    /https?:\/\/[a-z0-9.-]+\.mor\.org/i,
    "https://api.mor.org",
  );

  const envSnippet = `# add to .env
MORPHEUS_API_KEY=${apiKey}
MORPHEUS_BASE_URL=${baseUrl}`;

  const copy = async (
    text: string,
    setFlag: (v: boolean) => void,
  ) => {
    try {
      await navigator.clipboard.writeText(text);
      setFlag(true);
      setTimeout(() => setFlag(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] bg-card text-card-foreground">
        <DialogHeader className="space-y-2">
          <DialogTitle className="text-xl font-semibold text-foreground">
            Save this key now
            {keyName && (
              <span className="block text-sm font-normal text-muted-foreground mt-1">
                Nickname: <span className="font-mono text-foreground">{keyName}</span>
              </span>
            )}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
            For security, this is the only time the full key is visible. Store it
            in your secrets manager — you can rotate it later, but you can&apos;t
            read it back.
          </DialogDescription>
        </DialogHeader>

        {/* Key + Copy */}
        <div className="mt-4 flex items-stretch gap-2 rounded border border-border bg-background p-2">
          <code className="flex-1 self-center px-2 font-mono text-sm text-foreground break-all">
            {apiKey}
          </code>
          <button
            type="button"
            onClick={() => copy(apiKey, setCopiedKey)}
            aria-label="Copy API key"
            className="self-center inline-flex items-center justify-center h-8 w-8 rounded border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-primary/10 transition-colors shrink-0"
          >
            {copiedKey ? (
              <Check className="h-3.5 w-3.5 text-primary" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
        </div>

        {/* .env snippet */}
        <div className="mt-4 relative rounded border border-border bg-background p-4 pr-12 font-mono text-xs leading-relaxed overflow-x-auto">
          <button
            type="button"
            onClick={() => copy(envSnippet, setCopiedEnv)}
            aria-label="Copy .env snippet"
            className="absolute top-2 right-2 inline-flex items-center justify-center h-7 w-7 rounded border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-primary/10 transition-colors"
          >
            {copiedEnv ? (
              <Check className="h-3.5 w-3.5 text-primary" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
          <div className="text-muted-foreground"># add to .env</div>
          <div className="text-foreground">
            <span className="text-muted-foreground">MORPHEUS_API_KEY=</span>
            <span className="text-primary">{shortenKey(apiKey)}</span>
          </div>
          <div className="text-foreground">
            <span className="text-muted-foreground">MORPHEUS_BASE_URL=</span>
            <span className="text-primary">{baseUrl}</span>
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <Button
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
            onClick={() => onOpenChange(false)}
          >
            I&apos;ve saved it — done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
