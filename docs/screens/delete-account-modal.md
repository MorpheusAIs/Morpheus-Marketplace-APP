# Delete Account Modal

## Overview
A confirmation modal dialog for permanently deleting a user account. It requires the user to type "Delete" to confirm the destructive action.

## Component Structure

### Alert Dialog Container
- **Component**: `AlertDialog` (from `@/components/ui/alert-dialog`)
- **Props**:
  - `open`: `boolean`
  - `onOpenChange`: `(open: boolean) => void`

### Alert Dialog Content
- **Component**: `AlertDialogContent` (from `@/components/ui/alert-dialog`)
- **Props**: `className: "dark:bg-gray-900 rounded-lg p-6"`

#### Alert Dialog Header
- **Component**: `AlertDialogHeader` (from `@/components/ui/alert-dialog`)
- **Props**: `className: "space-y-4 mb-6"`
- **Alert Dialog Title**: `AlertDialogTitle` (from `@/components/ui/alert-dialog`)
  - **Props**: `className: "text-2xl font-bold text-red-500"`
  - **Content**: `"Delete Account"`
- **Alert Dialog Description**: `AlertDialogDescription` (from `@/components/ui/alert-dialog`)
  - **Props**: `className: "text-gray-400 text-sm leading-relaxed"`
  - **Content**: `"Are you sure you want to permanently delete your account? This action can not be undone."`

#### Confirmation Input Section
- **Container**: `div`
  - **Props**: `className: "mt-6 mb-8 space-y-2"`
- **Label**: `Label` (from `@/components/ui/label`)
  - **Props**: `htmlFor: "delete-confirmation" className: "text-gray-300 text-sm font-medium"`
  - **Content**: `Type "Delete"`
- **Input**: `Input` (from `@/components/ui/input`)
  - **Props**:
    - `id`: `"delete-confirmation"`
    - `type`: `"text"`
    - `placeholder`: `"Delete"`
    - `className`: `"bg-gray-800 border-gray-700 text-white focus:ring-red-500 focus:border-red-500"`
    - `value`: Controlled state
    - `onChange`: Input change handler

#### Alert Dialog Footer
- **Component**: `AlertDialogFooter` (from `@/components/ui/alert-dialog`)
- **Props**: `className: "flex justify-end gap-3 mt-6"`
- **Cancel Button**: `Button` (from `@/components/ui/button`)
  - **Props**: `variant: "ghost" className: "text-gray-300 hover:bg-gray-700"`
  - **Content**: `"Cancel"`
- **Delete Account Button**: `Button` (from `@/components/ui/button`)
  - **Props**:
    - `variant`: `"destructive"`
    - `className`: `"bg-red-600 hover:bg-red-700 text-white"`
    - `disabled`: `true` (until user types "Delete")
    - `onClick`: Delete handler
  - **Content**: `"Delete Account"`

## Implementation Example

```tsx
"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface DeleteAccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete?: () => Promise<void>;
}

export function DeleteAccountModal({
  open,
  onOpenChange,
  onDelete,
}: DeleteAccountModalProps) {
  const [confirmationText, setConfirmationText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const isConfirmed = confirmationText === "Delete";

  const handleDelete = async () => {
    if (!isConfirmed) return;

    setIsDeleting(true);
    try {
      await onDelete?.();
      setConfirmationText("");
      onOpenChange(false);
    } catch (err) {
      console.error("Failed to delete account:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="dark:bg-gray-900 rounded-lg p-6">
        <AlertDialogHeader className="space-y-4 mb-6">
          <AlertDialogTitle className="text-2xl font-bold text-red-500">
            Delete Account
          </AlertDialogTitle>
          <AlertDialogDescription className="text-gray-400 text-sm leading-relaxed">
            Are you sure you want to permanently delete your account? This action can not be
            undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="mt-6 mb-8 space-y-2">
          <Label htmlFor="delete-confirmation" className="text-gray-300 text-sm font-medium">
            Type "Delete"
          </Label>
          <Input
            id="delete-confirmation"
            type="text"
            placeholder="Delete"
            value={confirmationText}
            onChange={(e) => setConfirmationText(e.target.value)}
            className="bg-gray-800 border-gray-700 text-white focus:ring-red-500 focus:border-red-500"
            onKeyDown={(e) => {
              if (e.key === "Enter" && isConfirmed) {
                handleDelete();
              }
            }}
          />
        </div>
        <AlertDialogFooter className="flex justify-end gap-3 mt-6">
          <AlertDialogCancel asChild>
            <Button variant="ghost" className="text-gray-300 hover:bg-gray-700">
              Cancel
            </Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button
              variant="destructive"
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={handleDelete}
              disabled={!isConfirmed || isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete Account"}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

## Styling Notes
- Red accent (`text-red-500`, `bg-red-600 hover:bg-red-700`, `border-red-500`) for destructive action and title
- Dark theme with gray backgrounds
- Confirmation text must exactly match "Delete" to enable delete button
- Disabled state until confirmation is entered
- Loading state during deletion
- AlertDialog component for critical actions

