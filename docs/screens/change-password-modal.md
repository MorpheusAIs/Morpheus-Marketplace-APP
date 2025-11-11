# Change Password Modal

## Overview
A modal dialog for changing the user's password. It requires the previous password and confirmation of the new password, with visibility toggles for all password fields.

## Component Structure

### Dialog Container
- **Component**: `Dialog` (from `@/components/ui/dialog`)
- **Props**:
  - `open`: `boolean`
  - `onOpenChange`: `(open: boolean) => void`

### Dialog Content
- **Component**: `DialogContent` (from `@/components/ui/dialog`)
- **Props**: `className: "w-full max-w-md p-6 bg-card text-card-foreground rounded-lg shadow-lg border-none"`

#### Dialog Header
- **Component**: `DialogHeader` (from `@/components/ui/dialog`)
- **Props**: `className: "space-y-2"`
- **Dialog Title**: `DialogTitle` (from `@/components/ui/dialog`)
  - **Props**: `className: "text-2xl font-bold text-foreground"`
  - **Content**: `"Change Password"`
- **Dialog Description**: `DialogDescription` (from `@/components/ui/dialog`)
  - **Props**: `className: "text-muted-foreground text-sm"`
  - **Content**: `"Enter your current password to switch to a new password"`

#### Form Section
- **Container**: `form`
  - **Props**: `className: "mt-6 space-y-5"`

##### Previous Password Field
- **Container**: `div`
  - **Props**: `className: "space-y-2"`
- **Label**: `Label` (from `@/components/ui/label`)
  - **Props**: `htmlFor: "previous-password"`
  - **Content**: `"Previous Password"`
- **Input Container**: `div`
  - **Props**: `className: "relative"`
- **Input**: `Input` (from `@/components/ui/input`)
  - **Props**:
    - `id`: `"previous-password"`
    - `type`: `"password"` (toggleable)
    - `placeholder`: `"Enter password"`
    - `className`: `"pr-10"`
- **Eye Icon Button**: `Button` (from `@/components/ui/button`)
  - **Props**:
    - `type`: `"button"`
    - `variant`: `"ghost"`
    - `size`: `"sm"`
    - `className`: `"absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:bg-transparent"`
  - **Children**: `Eye` or `EyeOff` icon (from `lucide-react`)

##### New Password Field
- **Container**: `div`
  - **Props**: `className: "space-y-2"`
- **Label**: `Label` (from `@/components/ui/label`)
  - **Props**: `htmlFor: "new-password"`
  - **Content**: `"New Password"`
- **Input Container**: Same structure as previous password
- **Input**: `Input` (from `@/components/ui/input`)
  - **Props**: `id: "new-password" placeholder: "Enter new password"`
- **Eye Icon Button**: Same structure as previous password

##### Confirm New Password Field
- **Container**: `div`
  - **Props**: `className: "space-y-2"`
- **Label**: `Label` (from `@/components/ui/label`)
  - **Props**: `htmlFor: "confirm-new-password"`
  - **Content**: `"Confirm New Password"`
- **Input Container**: Same structure as previous password
- **Input**: `Input` (from `@/components/ui/input`)
  - **Props**: `id: "confirm-new-password" placeholder: "Enter new password"`
- **Eye Icon Button**: Same structure as previous password

#### Action Buttons
- **Container**: `div`
  - **Props**: `className: "flex justify-end space-x-3 pt-4"`
- **Cancel Button**: `Button` (from `@/components/ui/button`)
  - **Props**: `type: "button" variant: "outline" className: "px-6 py-2"`
  - **Content**: `"Cancel"`
- **Change Password Button**: `Button` (from `@/components/ui/button`)
  - **Props**:
    - `type`: `"submit"`
    - `variant`: `"default"`
    - `className`: `"bg-green-500 hover:bg-green-600 text-white px-6 py-2"`
  - **Content**: `"Change Password"`

## Implementation Example

```tsx
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff } from "lucide-react";

interface ChangePasswordModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPasswordChange?: (previousPassword: string, newPassword: string) => Promise<void>;
}

export function ChangePasswordModal({
  open,
  onOpenChange,
  onPasswordChange,
}: ChangePasswordModalProps) {
  const [previousPassword, setPreviousPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPreviousPassword, setShowPreviousPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!previousPassword || !newPassword || !confirmPassword) {
      setError("All fields are required");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match");
      return;
    }

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters long");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      await onPasswordChange?.(previousPassword, newPassword);
      setPreviousPassword("");
      setNewPassword("");
      setConfirmPassword("");
      onOpenChange(false);
    } catch (err) {
      setError("Failed to change password. Please check your previous password.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-md p-6 bg-card text-card-foreground rounded-lg shadow-lg border-none">
        <DialogHeader className="space-y-2">
          <DialogTitle className="text-2xl font-bold text-foreground">
            Change Password
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            Enter your current password to switch to a new password
          </DialogDescription>
        </DialogHeader>
        <form className="mt-6 space-y-5" onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
          {/* Previous Password */}
          <div className="space-y-2">
            <Label htmlFor="previous-password">Previous Password</Label>
            <div className="relative">
              <Input
                id="previous-password"
                type={showPreviousPassword ? "text" : "password"}
                placeholder="Enter password"
                value={previousPassword}
                onChange={(e) => {
                  setPreviousPassword(e.target.value);
                  setError("");
                }}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:bg-transparent"
                onClick={() => setShowPreviousPassword(!showPreviousPassword)}
              >
                {showPreviousPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* New Password */}
          <div className="space-y-2">
            <Label htmlFor="new-password">New Password</Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showNewPassword ? "text" : "password"}
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  setError("");
                }}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:bg-transparent"
                onClick={() => setShowNewPassword(!showNewPassword)}
              >
                {showNewPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Confirm New Password */}
          <div className="space-y-2">
            <Label htmlFor="confirm-new-password">Confirm New Password</Label>
            <div className="relative">
              <Input
                id="confirm-new-password"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Enter new password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setError("");
                }}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:bg-transparent"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              className="px-6 py-2"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="default"
              className="bg-green-500 hover:bg-green-600 text-white px-6 py-2"
              disabled={isLoading}
            >
              {isLoading ? "Changing..." : "Change Password"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

## Styling Notes
- Dark theme with rounded corners
- Password visibility toggles for all three fields
- Green accent (`bg-green-500 hover:bg-green-600`) for primary action
- Red accent (`text-red-500`) for error messages
- Form validation (matching passwords, minimum length)
- Error handling and display

