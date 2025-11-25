# Change Email Modal

## Overview
A modal dialog for changing the user's email address. It includes an input field for the new email and requires confirmation before the change is finalized.

## Component Structure

### Dialog Container
- **Component**: `Dialog` (from `@/components/ui/dialog`)
- **Props**:
  - `open`: `boolean`
  - `onOpenChange`: `(open: boolean) => void`

### Dialog Content
- **Component**: `DialogContent` (from `@/components/ui/dialog`)
- **Props**: `className: "sm:max-w-[425px]"`

#### Dialog Header
- **Component**: `DialogHeader` (from `@/components/ui/dialog`)
- **Dialog Title**: `DialogTitle` (from `@/components/ui/dialog`)
  - **Props**: `className: "text-2xl font-bold"`
  - **Content**: `"Change Email"`
- **Dialog Description**: `DialogDescription` (from `@/components/ui/dialog`)
  - **Props**: `className: "text-muted-foreground"`
  - **Content**: `"You will need to confirm your new email address before the change is final."`

#### Form Section
- **Container**: `div`
  - **Props**: `className: "grid gap-4 py-4"`
- **Label and Input Container**: `div`
  - **Props**: `className: "grid grid-cols-4 items-center gap-4"`
- **Label**: `Label` (from `@/components/ui/label`)
  - **Props**: `htmlFor: "new-email" className: "text-right col-span-4 sm:col-span-1"`
  - **Content**: `"New Email Address"`
- **Input**: `Input` (from `@/components/ui/input`)
  - **Props**:
    - `id`: `"new-email"`
    - `type`: `"email"`
    - `placeholder`: `"New Email Address"`
    - `className`: `"col-span-4 sm:col-span-3"`

#### Dialog Footer
- **Component**: `DialogFooter` (from `@/components/ui/dialog`)
- **Cancel Button**: `Button` (from `@/components/ui/button`)
  - **Props**: `variant: "outline"`
  - **Content**: `"Cancel"`
- **Change Email Button**: `Button` (from `@/components/ui/button`)
  - **Props**:
    - `variant`: `"default"`
    - `className`: `"bg-[#FD67C4] hover:bg-[#FD67C4]/90 text-white"`
    - `type`: `"submit"`
  - **Content**: `"Change Email"`

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ChangeEmailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentEmail?: string;
  onEmailChange?: (newEmail: string) => Promise<void>;
}

export function ChangeEmailModal({
  open,
  onOpenChange,
  currentEmail,
  onEmailChange,
}: ChangeEmailModalProps) {
  const [newEmail, setNewEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!newEmail.trim()) {
      setError("Please enter a new email address");
      return;
    }

    if (newEmail === currentEmail) {
      setError("New email must be different from current email");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      await onEmailChange?.(newEmail);
      setNewEmail("");
      onOpenChange(false);
    } catch (err) {
      setError("Failed to change email. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Change Email</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            You will need to confirm your new email address before the change is final.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="new-email" className="text-right col-span-4 sm:col-span-1">
              New Email Address
            </Label>
            <div className="col-span-4 sm:col-span-3">
              <Input
                id="new-email"
                type="email"
                placeholder="New Email Address"
                value={newEmail}
                onChange={(e) => {
                  setNewEmail(e.target.value);
                  setError("");
                }}
                className="col-span-4 sm:col-span-3"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSubmit();
                  }
                }}
              />
              {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="submit"
            className="bg-[#FD67C4] hover:bg-[#FD67C4]/90 text-white"
            onClick={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? "Changing..." : "Change Email"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

## Styling Notes
- Pink accent (`#FD67C4`) for account-related primary action
- Red accent (`text-red-500`) for error messages
- Responsive grid layout for label and input
- Email validation
- Loading state during submission
- Error handling

