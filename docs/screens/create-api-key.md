# Create API Key Screen

## Overview
A modal dialog or card form for creating a new API key. Users provide a name for the key, and the system generates the key upon submission.

## Component Structure

### Root Container
- **Container**: `div`
  - **Props**: `className: "flex items-center justify-center min-h-screen bg-background-dark-gradient"` (if full screen) or wrapped in `Dialog`

### Dialog (if modal)
- **Component**: `Dialog` (from `@/components/ui/dialog`)
- **Props**:
  - `open`: `boolean`
  - `onOpenChange`: `(open: boolean) => void`

### Dialog Content / Card
- **Component**: `DialogContent` (from `@/components/ui/dialog`) or `Card` (from `@/components/ui/card`)
- **Props**: `className: "w-[400px] p-6 bg-card text-card-foreground rounded-lg shadow-lg"`

#### Card Header
- **Component**: `DialogHeader` or `CardHeader` (from `@/components/ui/card`)
- **Props**: `className: "pb-4"`
- **Card Title**: `DialogTitle` or `CardTitle` (from `@/components/ui/card`)
  - **Props**: `className: "text-2xl font-bold"`
  - **Content**: `"Create An API Key"`

#### Card Content
- **Component**: `DialogContent` (body) or `CardContent` (from `@/components/ui/card`)
- **Props**: `className: "space-y-6"`

##### Key Name Input Group
- **Container**: `div`
  - **Props**: `className: "space-y-2"`
- **Label**: `Label` (from `@/components/ui/label`)
  - **Props**: `htmlFor: "key-name" className: "text-base font-medium"`
  - **Content**: `"Key Name"`
- **Input**: `Input` (from `@/components/ui/input`)
  - **Props**:
    - `id`: `"key-name"`
    - `type`: `"text"`
    - `placeholder`: `"Name your API key"`
    - `className`: `"bg-input border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-ring"`

#### Card Footer / Dialog Footer
- **Component**: `DialogFooter` (from `@/components/ui/dialog`) or `CardFooter` (from `@/components/ui/card`)
- **Props**: `className: "pt-6"`
- **Create Key Button**: `Button` (from `@/components/ui/button`)
  - **Props**:
    - `type`: `"submit"`
    - `className`: `"w-full bg-primary text-primary-foreground hover:bg-primary/90 rounded-md py-2 text-lg font-semibold"`
  - **Children**:
    - `span`: `"Create Key"`
    - `ArrowRight` icon (from `lucide-react`): `className: "ml-2 h-5 w-5"`

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
import { ArrowRight } from "lucide-react";

interface CreateApiKeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateKey?: (name: string) => void;
}

export function CreateApiKeyDialog({
  open,
  onOpenChange,
  onCreateKey,
}: CreateApiKeyDialogProps) {
  const [keyName, setKeyName] = useState("");

  const handleSubmit = () => {
    if (keyName.trim()) {
      onCreateKey?.(keyName.trim());
      setKeyName("");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[400px] p-6 bg-card text-card-foreground rounded-lg shadow-lg">
        <DialogHeader className="pb-4">
          <DialogTitle className="text-2xl font-bold">Create An API Key</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="key-name" className="text-base font-medium">
              Key Name
            </Label>
            <Input
              id="key-name"
              type="text"
              placeholder="Name your API key"
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
              className="bg-input border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-ring"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSubmit();
                }
              }}
            />
          </div>
        </div>
        <DialogFooter className="pt-6">
          <Button
            type="submit"
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 rounded-md py-2 text-lg font-semibold"
            onClick={handleSubmit}
            disabled={!keyName.trim()}
          >
            Create Key
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

## Styling Notes
- Fixed width (`w-[400px]`) for consistent modal size
- Dark theme using Shadcn UI theme variables
- Primary button styling with green accent (if theme configured)
- Form validation should ensure key name is not empty

