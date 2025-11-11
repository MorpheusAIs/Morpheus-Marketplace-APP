# Verify API Key Modal

## Overview
A modal dialog that prompts users to verify their full API key before enabling Chat and Test functionality. This ensures security by requiring users to confirm they have access to the complete key.

## Component Structure

### Dialog Container
- **Component**: `Dialog` (from `@/components/ui/dialog`)
- **Props**:
  - `open`: `boolean`
  - `onOpenChange`: `(open: boolean) => void`

### Dialog Content
- **Component**: `DialogContent` (from `@/components/ui/dialog`)
- **Props**: `className: "sm:max-w-[425px] bg-card text-foreground rounded-lg p-6"`

#### Dialog Header
- **Component**: `DialogHeader` (from `@/components/ui/dialog`)
- **Dialog Title**: `DialogTitle` (from `@/components/ui/dialog`)
  - **Props**: `className: "text-2xl font-bold text-white"`
  - **Content**: `"Verify Your API Key"`

#### Information Text
- **Selected Key Info**: `p`
  - **Props**: `className: "text-sm text-muted-foreground mt-4"`
  - **Content**: `"You've selected: {truncatedKey}..."`
- **Explanation**: `p`
  - **Props**: `className: "text-sm text-muted-foreground mt-2"`
  - **Content**: `"To ensure the security of your data, we need you to verify the full API key to enable Chat and Test functionality."`

#### Form Section
- **Container**: `div`
  - **Props**: `className: "grid gap-4 py-4"`
- **Label**: `Label` (from `@/components/ui/label`)
  - **Props**: `htmlFor: "api-key-input" className: "text-base font-semibold text-white"`
  - **Content**: `"Enter Full API Key"`
- **Input**: `Input` (from `@/components/ui/input`)
  - **Props**:
    - `id`: `"api-key-input"`
    - `type`: `"password"` (recommended for security)
    - `placeholder`: `"sk-MbUtSa..."`
    - `className`: `"col-span-3 bg-input border-input text-foreground"`
- **Hint Text**: `p`
  - **Props**: `className: "text-xs text-muted-foreground mt-1"`
  - **Content**: `"Must start with \"{keyPrefix}\""`

#### Dialog Footer
- **Component**: `DialogFooter` (from `@/components/ui/dialog`)
- **Props**: `className: "flex justify-end gap-2 mt-4"`
- **Cancel Button**: `Button` (from `@/components/ui/button`)
  - **Props**:
    - `variant`: `"outline"`
    - `onClick`: Close dialog handler
  - **Content**: `"Cancel"`
- **Verify Button**: `Button` (from `@/components/ui/button`)
  - **Props**:
    - `variant`: `"default"`
    - `className`: `"bg-green-500 hover:bg-green-600 text-white"`
    - `type`: `"submit"`
    - `onClick`: Verify handler
  - **Content**: `"Verify & Continue"`

## Implementation Example

```tsx
"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface VerifyApiKeyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedKeyPrefix: string; // e.g., "sk-MbUtSa"
  onVerify: (fullKey: string) => Promise<boolean>;
}

export function VerifyApiKeyModal({
  open,
  onOpenChange,
  selectedKeyPrefix,
  onVerify,
}: VerifyApiKeyModalProps) {
  const [apiKey, setApiKey] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState("");

  const handleVerify = async () => {
    if (!apiKey.trim()) {
      setError("Please enter your API key");
      return;
    }

    if (!apiKey.startsWith(selectedKeyPrefix)) {
      setError(`API key must start with "${selectedKeyPrefix}"`);
      return;
    }

    setIsVerifying(true);
    setError("");

    try {
      const isValid = await onVerify(apiKey);
      if (isValid) {
        setApiKey("");
        onOpenChange(false);
      } else {
        setError("Invalid API key. Please try again.");
      }
    } catch (err) {
      setError("Verification failed. Please try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-card text-foreground rounded-lg p-6">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-white">
            Verify Your API Key
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground mt-4">
          You've selected: {selectedKeyPrefix}...
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          To ensure the security of your data, we need you to verify the full API key to
          enable Chat and Test functionality.
        </p>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="api-key-input" className="text-base font-semibold text-white">
              Enter Full API Key
            </Label>
            <Input
              id="api-key-input"
              type="password"
              placeholder={`${selectedKeyPrefix}...`}
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                setError("");
              }}
              className="col-span-4 bg-input border-input text-foreground"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleVerify();
                }
              }}
            />
            <p className="text-xs text-muted-foreground mt-1 col-span-4">
              Must start with "{selectedKeyPrefix}"
            </p>
            {error && (
              <p className="text-xs text-red-500 mt-1 col-span-4">{error}</p>
            )}
          </div>
        </div>
        <DialogFooter className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="default"
            className="bg-green-500 hover:bg-green-600 text-white"
            onClick={handleVerify}
            disabled={isVerifying}
          >
            {isVerifying ? "Verifying..." : "Verify & Continue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

## Styling Notes
- Dark theme with muted text for descriptions
- Password input type for security
- Validation hint showing required key prefix
- Green accent for primary action
- Error state handling for invalid keys
- Loading state during verification

