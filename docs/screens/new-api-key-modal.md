# New API Key Modal

## Overview
A modal dialog displayed after successfully creating an API key. It shows the generated key with a warning that it won't be shown again, and provides options to copy the key or close the dialog.

## Component Structure

### Dialog Container
- **Component**: `Dialog` (from `@/components/ui/dialog`)
- **Props**:
  - `open`: `boolean`
  - `onOpenChange`: `(open: boolean) => void`

### Dialog Content
- **Component**: `DialogContent` (from `@/components/ui/dialog`)
- **Props**: `className: "sm:max-w-[500px] bg-card text-card-foreground"`

#### Dialog Header
- **Component**: `DialogHeader` (from `@/components/ui/dialog`)
- **Dialog Title**: `DialogTitle` (from `@/components/ui/dialog`)
  - **Props**: `className: "text-2xl font-bold text-white"`
  - **Content**: `"Your New API Key"`
- **Dialog Description**: `DialogDescription` (from `@/components/ui/dialog`)
  - **Props**: `className: "text-muted-foreground mt-2"`
  - **Content**: `"This is your API key nicknamed **{keyName}**. Save this key now, it won't be shown again!"`
  - **Note**: The key name should be rendered in bold

#### API Key Display Area
- **Container**: `div`
  - **Props**: `className: "relative mt-4 p-4 bg-gray-800 border border-orange-500 rounded-md"`
- **API Key Text**: `div` or `pre`
  - **Props**: `className: "font-mono text-sm text-white break-words pr-10"`
  - **Content**: Full API key string (e.g., `"sk-AxNSFT.85fd7231cd71942d05939b765392e9e993787b2cd0288baa4b71cd1b56d71df7"`)
- **Copy Button**: `Button` (from `@/components/ui/button`)
  - **Props**:
    - `variant`: `"ghost"`
    - `size`: `"icon"`
    - `className`: `"absolute top-2 right-2"`
    - `onClick`: Copy to clipboard handler
  - **Children**: `Copy` icon (from `lucide-react`): `className: "h-4 w-4"`

#### Dialog Footer
- **Component**: `DialogFooter` (from `@/components/ui/dialog`)
- **Close Button**: `Button` (from `@/components/ui/button`)
  - **Props**:
    - `variant`: `"default"`
    - `className`: `"w-full bg-green-500 hover:bg-green-600 text-white"`
    - `onClick`: Close dialog handler
  - **Content**: `"Close"`

## Implementation Example

```tsx
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
  keyName: string;
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
          <DialogTitle className="text-2xl font-bold text-white">
            Your New API Key
          </DialogTitle>
          <DialogDescription className="text-muted-foreground mt-2">
            This is your API key nicknamed <strong>{keyName}</strong>. Save this key now,
            it won't be shown again!
          </DialogDescription>
        </DialogHeader>
        <div className="relative mt-4 p-4 bg-gray-800 border border-orange-500 rounded-md">
          <div className="font-mono text-sm text-white break-words pr-10">
            {apiKey}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2"
            onClick={handleCopy}
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>
        <DialogFooter>
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
```

## Styling Notes
- Orange border (`border-orange-500`) to draw attention to the API key
- Monospace font for the API key display
- Word break enabled for long keys
- Copy button with visual feedback (checkmark when copied)
- Dark background (`bg-gray-800`) for the key display area
- Green button for primary action

