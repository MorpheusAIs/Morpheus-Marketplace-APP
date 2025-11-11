# Sidebar Component

## Overview
A fixed-width, dark-themed vertical navigation sidebar used across all authenticated screens. It provides primary navigation, chat history management, and user account actions. The sidebar adapts its content based on the current route (e.g., showing chat history when on the chat route).

## Component Structure

### Root Container
- **Component**: `aside` (HTML semantic element) or `Sidebar` (from `@/components/ui/sidebar` if using Shadcn sidebar)
- **Props**: `className: "w-[280px] bg-gray-900 text-gray-50 flex flex-col h-full p-4 border-r border-gray-800"`

### Sidebar Header
- **Container**: `div`
  - **Props**: `className: "flex items-center space-x-3"`
  - **Logo**: Custom SVG or `Image` component
    - **Props**: `className: "h-8 w-8"`
    - **Alt**: `"App Logo"`
  - **App Name** (optional): `span` or `p`
    - **Props**: `className: "text-lg font-semibold"`

### Sidebar Navigation
- **Container**: `nav`
  - **Props**: `className: "flex-1 space-y-2 mt-6"`

#### Primary Navigation Links
Each navigation item is a `Button` component with ghost variant:

- **Component**: `Button` (from `@/components/ui/button`)
- **Props**:
  - `variant`: `"ghost"`
  - `className`: `"w-full justify-start text-base"`
  - `asChild`: `true` (if wrapping Link)
- **Structure**: Icon + Text
- **Icons** (from `lucide-react`):
  - API Keys: `Key`
  - Chat: `MessageSquare`
  - Test: `FlaskConical`
  - Docs: `FileText` (with `ExternalLink` icon)

**Active State**:
- When active, add: `className: "bg-gray-800"` or `"bg-primary/10"`
- For expandable items (like Chat), include `ChevronDown` icon

#### Chat Section (Expanded State)
Visible when Chat route is active:

- **Container**: `div`
  - **Props**: `className: "space-y-2 pl-4 py-2"`

##### New Chat Button
- **Component**: `Button` (from `@/components/ui/button`)
- **Props**:
  - `variant`: `"outline"`
  - `className`: `"w-full justify-start text-base"`
- **Children**:
  - `Plus` icon (from `lucide-react`)
  - `span`: `"New Chat"`

##### Save Chat History Toggle
- **Container**: `div`
  - **Props**: `className: "flex items-center justify-between gap-2"`
- **Label**: `Label` (from `@/components/ui/label`)
  - **Props**: `htmlFor: "save-chat-history" className: "flex-1"`
  - **Content**: `"Save Chat History"`
- **Switch**: `Switch` (from `@/components/ui/switch`)
  - **Props**:
    - `id`: `"save-chat-history"`
    - `checked`: `boolean` (controlled state)
    - `onCheckedChange`: `(checked: boolean) => void`

##### Chat History List
- **Component**: `ScrollArea` (from `@/components/ui/scroll-area`)
  - **Props**: `className: "h-[200px]"`
- **Container**: `div`
  - **Props**: `className: "space-y-1"`
- **Chat History Items**: `Button` (from `@/components/ui/button`)
  - **Props**:
    - `variant`: `"ghost"`
    - `className`: `"w-full justify-between text-sm"` (+ active state classes if selected)
  - **Children**:
    - `span`: Chat title
    - `Button` (icon button): `variant="ghost" size="sm"`
      - **Children**: `MoreHorizontal` icon (from `lucide-react`)

**Selected State**:
- Add: `className: "bg-primary/20"` or `"bg-gray-800"`

#### Utility Links
Same structure as primary navigation links:
- Test: `FlaskConical` icon
- Docs: `FileText` icon + `ExternalLink` icon

### Sidebar Footer
- **Container**: `div`
  - **Props**: `className: "mt-auto space-y-2 pt-4 border-t border-gray-800"`

#### Account Link
- **Component**: `Button` (from `@/components/ui/button`)
- **Props**:
  - `variant`: `"ghost"`
  - `className`: `"w-full justify-start text-base"`
- **Children**:
  - `User` icon (from `lucide-react`)
  - `span`: `"Account"`

#### Log Out Link
- **Component**: `Button` (from `@/components/ui/button`)
- **Props**:
  - `variant`: `"ghost"`
  - `className`: `"w-full justify-start text-base"`
- **Children**:
  - `LogOut` icon (from `lucide-react`)
  - `span`: `"Log Out"`

## Different States

### Default State
- Shows all primary navigation links
- No expanded sections
- Standard navigation items visible

### Chat Route Active State
- Chat navigation item highlighted
- Chat section expanded below Chat link
- Shows:
  - New Chat button
  - Save Chat History toggle
  - Scrollable chat history list
- Chat history items can be selected (highlighted state)

### Selected Chat History Item
- Individual chat history item highlighted
- `bg-primary/20` or `bg-gray-800` applied
- Can show options menu on hover/click

## Implementation Example

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Key,
  MessageSquare,
  FlaskConical,
  FileText,
  ExternalLink,
  User,
  LogOut,
  Plus,
  MoreHorizontal,
  ChevronDown,
} from "lucide-react";

interface ChatHistoryItem {
  id: string;
  title: string;
}

interface SidebarProps {
  chatHistory?: ChatHistoryItem[];
  selectedChatId?: string;
  onChatSelect?: (chatId: string) => void;
  onNewChat?: () => void;
  saveChatHistory?: boolean;
  onSaveChatHistoryChange?: (checked: boolean) => void;
}

export function Sidebar({
  chatHistory = [],
  selectedChatId,
  onChatSelect,
  onNewChat,
  saveChatHistory = true,
  onSaveChatHistoryChange,
}: SidebarProps) {
  const pathname = usePathname();
  const isChatRoute = pathname?.startsWith("/chat");

  return (
    <aside className="w-[280px] bg-gray-900 text-gray-50 flex flex-col h-full p-4 border-r border-gray-800">
      {/* Header */}
      <div className="flex items-center space-x-3">
        {/* Logo component */}
        <div className="h-8 w-8 bg-white rounded" />
        <span className="text-lg font-semibold">API Gateway Admin</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-2 mt-6">
        {/* API Keys */}
        <Link href="/api-keys">
          <Button
            variant="ghost"
            className={`w-full justify-start text-base ${
              pathname === "/api-keys" ? "bg-gray-800" : ""
            }`}
          >
            <Key className="mr-2 h-4 w-4" />
            API Keys
          </Button>
        </Link>

        {/* Chat */}
        <Link href="/chat">
          <Button
            variant="ghost"
            className={`w-full justify-start text-base ${
              isChatRoute ? "bg-gray-800" : ""
            }`}
          >
            <MessageSquare className="mr-2 h-4 w-4" />
            Chat
            {isChatRoute && <ChevronDown className="ml-auto h-4 w-4" />}
          </Button>
        </Link>

        {/* Chat Section (Expanded when Chat route is active) */}
        {isChatRoute && (
          <div className="space-y-2 pl-4 py-2">
            <Button
              variant="outline"
              className="w-full justify-start text-base"
              onClick={onNewChat}
            >
              <Plus className="mr-2 h-4 w-4" />
              New Chat
            </Button>

            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="save-chat-history" className="flex-1">
                Save Chat History
              </Label>
              <Switch
                id="save-chat-history"
                checked={saveChatHistory}
                onCheckedChange={onSaveChatHistoryChange}
              />
            </div>

            <ScrollArea className="h-[200px]">
              <div className="space-y-1">
                {chatHistory.map((chat) => (
                  <Button
                    key={chat.id}
                    variant="ghost"
                    className={`w-full justify-between text-sm ${
                      selectedChatId === chat.id ? "bg-primary/20" : ""
                    }`}
                    onClick={() => onChatSelect?.(chat.id)}
                  >
                    <span className="truncate">{chat.title}</span>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </Button>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Test */}
        <Link href="/test">
          <Button
            variant="ghost"
            className={`w-full justify-start text-base ${
              pathname === "/test" ? "bg-gray-800" : ""
            }`}
          >
            <FlaskConical className="mr-2 h-4 w-4" />
            Test
          </Button>
        </Link>

        {/* Docs */}
        <Link href="/docs" target="_blank">
          <Button
            variant="ghost"
            className="w-full justify-start text-base"
          >
            <FileText className="mr-2 h-4 w-4" />
            Docs
            <ExternalLink className="ml-auto h-4 w-4" />
          </Button>
        </Link>
      </nav>

      {/* Footer */}
      <div className="mt-auto space-y-2 pt-4 border-t border-gray-800">
        <Link href="/account">
          <Button variant="ghost" className="w-full justify-start text-base">
            <User className="mr-2 h-4 w-4" />
            Account
          </Button>
        </Link>
        <Button variant="ghost" className="w-full justify-start text-base">
          <LogOut className="mr-2 h-4 w-4" />
          Log Out
        </Button>
      </div>
    </aside>
  );
}
```

## Styling Notes
- Fixed width (`w-[280px]`) for consistent layout
- Dark theme (`bg-gray-900`) with light text
- Active states use `bg-gray-800` or `bg-primary/10`
- Scrollable chat history with fixed height
- Border separators for visual organization
- Icons from `lucide-react` with consistent sizing (`h-4 w-4`)

