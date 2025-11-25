"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";

interface NewApiKeyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  apiKey: string;
  keyName?: string;
}

export function NewApiKeyModal({
  open,
  onOpenChange,
  apiKey,
  keyName,
}: NewApiKeyModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-card text-card-foreground">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-foreground">
            {keyName ? (
              <>
                This is your API key nicknamed <strong>{keyName}</strong>. Save this key now,
                it won't be shown again!
              </>
            ) : (
              <>Save this key now, it won't be shown again!</>
            )}
          </DialogTitle>
        </DialogHeader>
        <div className="relative mt-6">
          <div className="relative p-4 bg-gray-800 border-2 border-orange-500 rounded-md">
            <div className="font-mono text-sm text-white break-all pr-12">
              {apiKey}
            </div>
            <Button
              variant="outline"
              size="icon"
              className="absolute top-2 right-2 h-8 w-8 border-green-500 text-green-500 hover:bg-green-500 hover:text-white"
              onClick={handleCopy}
            >
              {copied ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
        <DialogFooter className="mt-6">
          <Button
            className="w-full bg-green-500 hover:bg-green-600 text-white"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

