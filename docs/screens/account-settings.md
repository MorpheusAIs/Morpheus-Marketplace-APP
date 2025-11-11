# Account Settings Screen

## Overview
A screen for managing user account settings, including authentication details (email, password) and automation settings (API key, session duration, automation toggle). This screen is part of the authenticated layout.

## Component Structure

### Root Layout
- **Container**: `div`
  - **Props**: `className: "flex h-screen bg-background"`

### Sidebar
- **Component**: `Sidebar` (see `docs/components/sidebar.md`)
- **Props**: Standard sidebar props

### Main Content Area
- **Container**: `div`
  - **Props**: `className: "flex-1 overflow-y-auto p-8"`

### Header Section
- **Title**: `h1`
  - **Props**: `className: "text-4xl font-bold text-white"`
  - **Content**: `"Account Settings"`
- **Subtitle**: `p`
  - **Props**: `className: "text-muted-foreground mt-2 text-gray-400"`
  - **Content**: `"Manage your account preferences and settings"`

### Account Authentication Card
- **Component**: `Card` (from `@/components/ui/card`)
  - **Props**: `className: "mt-8 bg-card border-border"`

#### Card Header
- **Component**: `CardHeader` (from `@/components/ui/card`)
- **Card Title**: `CardTitle` (from `@/components/ui/card`)
  - **Props**: `className: "text-xl font-semibold text-white"`
  - **Content**: `"Account Authentication"`

#### Card Content
- **Component**: `CardContent` (from `@/components/ui/card`)

##### Email Address Field
- **Container**: `div`
  - **Props**: `className: "flex items-center justify-between space-x-4 py-4 border-b border-border"`
- **Label**: `Label` (from `@/components/ui/label`)
  - **Props**: `htmlFor: "email" className: "text-white"`
  - **Content**: `"Email Address"`
- **Email Value**: `span`
  - **Props**: `className: "text-muted-foreground text-gray-400"`
  - **Content**: Email address (e.g., `"me@justinellis.co"`)
- **Change Button**: `Button` (from `@/components/ui/button`)
  - **Props**: `variant: "outline" size: "sm" className: "text-[#FD67C4] border-[#FD67C4] hover:bg-[#FD67C4]/10"`
  - **Children**: `Pencil` icon (from `lucide-react`) + `"Change"`

##### Password Field
- **Container**: `div`
  - **Props**: `className: "flex items-center justify-between space-x-4 py-4 border-b border-border"`
- **Label**: `Label` (from `@/components/ui/label`)
  - **Props**: `htmlFor: "password" className: "text-white"`
  - **Content**: `"Password"`
- **Password Value**: `span`
  - **Props**: `className: "text-muted-foreground text-gray-400"`
  - **Content**: `"••••••••••"`
- **Change Button**: `Button` (from `@/components/ui/button`)
  - **Props**: Same as email change button
  - **Children**: `Pencil` icon (from `lucide-react`) + `"Change"`

##### Delete Account Section
- **Container**: `div`
  - **Props**: `className: "mt-8 p-4 bg-red-900/20 border border-red-500 rounded-md flex items-center justify-between"`
- **Text Content**: `div`
  - **Title**: `p`
    - **Props**: `className: "font-semibold text-red-500"`
    - **Content**: `"Delete Account"`
  - **Warning**: `p`
    - **Props**: `className: "text-sm text-red-400"`
    - **Content**: `"WARNING! This action can not be undone"`
- **Delete Button**: `Button` (from `@/components/ui/button`)
  - **Props**: `variant: "destructive" size: "sm"`
  - **Children**: `Trash2` icon (from `lucide-react`) + `"Delete"`

### Automation Settings Card
- **Component**: `Card` (from `@/components/ui/card`)
  - **Props**: `className: "mt-8 bg-card border-border"`

#### Card Header
- **Component**: `CardHeader` (from `@/components/ui/card`)
- **Card Title**: `CardTitle` (from `@/components/ui/card`)
  - **Props**: `className: "text-xl font-semibold text-white"`
  - **Content**: `"Automation Settings"`

#### Card Content
- **Component**: `CardContent` (from `@/components/ui/card`)

##### Selected API Key Display
- **Container**: `div`
  - **Props**: `className: "py-4 border-b border-border"`
- **Label**: `Label` (from `@/components/ui/label`)
  - **Props**: `className: "text-white"`
  - **Content**: `"Selected API Key:"`
- **API Key Value**: `span`
  - **Props**: `className: "ml-2 font-mono text-sm text-gray-300"`
  - **Content**: API key (e.g., `"sk-nbnsRJ-bf5g3a-Arbn5f"`)
- **Verified Status**: `div`
  - **Props**: `className: "flex items-center mt-2"`
  - **Status Dot**: `div`
    - **Props**: `className: "h-2 w-2 rounded-full bg-green-500 mr-2"`
  - **Text**: `span`
    - **Props**: `className: "text-green-500 text-sm"`
    - **Content**: `"Verified"`
- **Functionality Status**: `div`
  - **Props**: `className: "flex items-center mt-1"`
  - **Checkmark**: `CheckCircle` icon (from `lucide-react`)
    - **Props**: `className: "h-4 w-4 text-green-500 mr-2"`
  - **Text**: `span`
    - **Props**: `className: "text-green-500 text-sm"`
    - **Content**: `"Ready for Chat and Test Functionality"`

##### Session Duration
- **Container**: `div`
  - **Props**: `className: "mt-6 py-4 border-b border-border"`
- **Label**: `Label` (from `@/components/ui/label`)
  - **Props**: `htmlFor: "session-duration" className: "text-white"`
  - **Content**: `"Session Duration (seconds)"`
- **Input**: `Input` (from `@/components/ui/input`)
  - **Props**:
    - `id`: `"session-duration"`
    - `type`: `"number"`
    - `defaultValue`: `"86400"`
    - `className`: `"mt-2 bg-input border-border text-white"`
- **Hint**: `p`
  - **Props**: `className: "text-muted-foreground text-sm mt-1 text-gray-500"`
  - **Content**: `"How long authentication sessions last. Minimum is 1 second."`

##### Enable Automation Toggle
- **Container**: `div`
  - **Props**: `className: "flex items-center justify-between mt-6 py-4"`
- **Label**: `Label` (from `@/components/ui/label`)
  - **Props**: `htmlFor: "enable-automation" className: "text-white"`
  - **Content**: `"Enable Automation?"`
- **Switch**: `Switch` (from `@/components/ui/switch`)
  - **Props**: `id: "enable-automation" defaultChecked: true`

#### Card Footer
- **Component**: `CardFooter` (from `@/components/ui/card`)
  - **Props**: `className: "flex justify-end space-x-2 mt-8 pt-4 border-t border-border"`
- **Cancel Button**: `Button` (from `@/components/ui/button`)
  - **Props**: `variant: "outline" className: "text-white border-gray-700 hover:bg-gray-700"`
  - **Content**: `"Cancel"`
- **Save Changes Button**: `Button` (from `@/components/ui/button`)
  - **Props**: `variant: "default" className: "bg-green-600 hover:bg-green-700 text-white"`
  - **Content**: `"Save Changes"`

## Implementation Example

```tsx
"use client";

import { useState } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Pencil, Trash2, CheckCircle } from "lucide-react";
import { Sidebar } from "@/components/sidebar";
import { ChangeEmailModal } from "@/components/change-email-modal";
import { ChangePasswordModal } from "@/components/change-password-modal";
import { DeleteAccountModal } from "@/components/delete-account-modal";

export default function AccountSettingsPage() {
  const [email] = useState("me@justinellis.co");
  const [selectedApiKey] = useState("sk-nbnsRJ-bf5g3a-Arbn5f");
  const [sessionDuration, setSessionDuration] = useState(86400);
  const [enableAutomation, setEnableAutomation] = useState(true);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 overflow-y-auto p-8">
        <h1 className="text-4xl font-bold text-white">Account Settings</h1>
        <p className="text-muted-foreground mt-2 text-gray-400">
          Manage your account preferences and settings
        </p>

        {/* Account Authentication */}
        <Card className="mt-8 bg-card border-border">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-white">
              Account Authentication
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Email */}
            <div className="flex items-center justify-between space-x-4 py-4 border-b border-border">
              <Label htmlFor="email" className="text-white">
                Email Address
              </Label>
              <span className="text-muted-foreground text-gray-400">{email}</span>
              <Button
                variant="outline"
                size="sm"
                className="text-[#FD67C4] border-[#FD67C4] hover:bg-[#FD67C4]/10"
                onClick={() => setIsEmailModalOpen(true)}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Change
              </Button>
            </div>

            {/* Password */}
            <div className="flex items-center justify-between space-x-4 py-4 border-b border-border">
              <Label htmlFor="password" className="text-white">
                Password
              </Label>
              <span className="text-muted-foreground text-gray-400">••••••••••</span>
              <Button
                variant="outline"
                size="sm"
                className="text-[#FD67C4] border-[#FD67C4] hover:bg-[#FD67C4]/10"
                onClick={() => setIsPasswordModalOpen(true)}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Change
              </Button>
            </div>

            {/* Delete Account */}
            <div className="mt-8 p-4 bg-red-900/20 border border-red-500 rounded-md flex items-center justify-between">
              <div>
                <p className="font-semibold text-red-500">Delete Account</p>
                <p className="text-sm text-red-400">WARNING! This action can not be undone</p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setIsDeleteModalOpen(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Automation Settings */}
        <Card className="mt-8 bg-card border-border">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-white">
              Automation Settings
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* API Key */}
            <div className="py-4 border-b border-border">
              <Label className="text-white">Selected API Key:</Label>
              <span className="ml-2 font-mono text-sm text-gray-300">{selectedApiKey}</span>
              <div className="flex items-center mt-2">
                <div className="h-2 w-2 rounded-full bg-green-500 mr-2"></div>
                <span className="text-green-500 text-sm">Verified</span>
              </div>
              <div className="flex items-center mt-1">
                <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                <span className="text-green-500 text-sm">
                  Ready for Chat and Test Functionality
                </span>
              </div>
            </div>

            {/* Session Duration */}
            <div className="mt-6 py-4 border-b border-border">
              <Label htmlFor="session-duration" className="text-white">
                Session Duration (seconds)
              </Label>
              <Input
                id="session-duration"
                type="number"
                value={sessionDuration}
                onChange={(e) => setSessionDuration(parseInt(e.target.value))}
                className="mt-2 bg-input border-border text-white"
              />
              <p className="text-muted-foreground text-sm mt-1 text-gray-500">
                How long authentication sessions last. Minimum is 1 second.
              </p>
            </div>

            {/* Enable Automation */}
            <div className="flex items-center justify-between mt-6 py-4">
              <Label htmlFor="enable-automation" className="text-white">
                Enable Automation?
              </Label>
              <Switch
                id="enable-automation"
                checked={enableAutomation}
                onCheckedChange={setEnableAutomation}
              />
            </div>
          </CardContent>
          <CardFooter className="flex justify-end space-x-2 mt-8 pt-4 border-t border-border">
            <Button variant="outline" className="text-white border-gray-700 hover:bg-gray-700">
              Cancel
            </Button>
            <Button className="bg-green-600 hover:bg-green-700 text-white">
              Save Changes
            </Button>
          </CardFooter>
        </Card>
      </div>

      <ChangeEmailModal open={isEmailModalOpen} onOpenChange={setIsEmailModalOpen} />
      <ChangePasswordModal open={isPasswordModalOpen} onOpenChange={setIsPasswordModalOpen} />
      <DeleteAccountModal open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen} />
    </div>
  );
}
```

## Styling Notes
- Dark theme with card-based sections
- Pink accent (`#FD67C4`) for account-related action buttons (Change email/password)
- Red accent (`text-red-500`, `bg-red-500`, `border-red-500`) for destructive actions (delete account)
- Green accent (`bg-green-500`, `text-green-500`) for verified status and primary actions
- Border separators between form fields
- Monospace font for API keys

