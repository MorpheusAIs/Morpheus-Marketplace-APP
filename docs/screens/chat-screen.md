# Chat Screen

## Overview
The main chat interface screen displaying an ongoing conversation between a user and an AI assistant. It includes a header with chat metadata, a scrollable message area, and an input field for sending messages.

## Component Structure

### Root Layout
- **Container**: `div`
  - **Props**: `className: "flex h-screen bg-background"`

### Sidebar
- **Component**: `Sidebar` (see `docs/components/sidebar.md`)
- **Props**: Standard sidebar props with chat history

### Main Chat Container
- **Container**: `div`
  - **Props**: `className: "flex flex-col h-full flex-1 bg-gray-950 text-gray-50"`

#### Chat Header
- **Component**: `header`
  - **Props**: `className: "p-4 border-b border-gray-800 flex justify-between items-center"`
- **Chat Title and API Key**: `div`
  - **Title**: `h2`
    - **Props**: `className: "text-xl font-semibold"`
    - **Content**: Chat title (e.g., `"Who is Satoshi?"`)
  - **API Key**: `p`
    - **Props**: `className: "text-sm text-gray-400"`
    - **Content**: `"API Key: {truncatedKey} ..."`
- **Settings Button**: `Button` (from `@/components/ui/button`)
  - **Props**: `variant: "ghost" size: "icon"`
  - **Children**: `Settings` icon (from `lucide-react`)

#### Chat Conversation Area
- **Component**: `main` or use `Conversation` (from `@ai-elements/conversation`)
  - **Props**: `className: "flex-1 overflow-y-auto p-4 space-y-6"`

**Message Components**:
- Use `Message` (from `@ai-elements/message`) or custom message components

**User Message**:
- **Container**: `div`
  - **Props**: `className: "bg-purple-800 rounded-lg p-3 max-w-[70%] ml-auto"`
- **Message Content**: `p` or `MarkdownText` (from `@assistant-ui/markdown-text`)
- **Metadata**: `div`
  - **Props**: `className: "flex items-center gap-2 text-xs text-gray-400 mt-1"`
  - **Timestamp**: `span` (e.g., `"12:56p"`)
  - **Actions**: Icon buttons (Copy, Edit, Trash2, ThumbsUp, ThumbsDown from `lucide-react`)
    - **Component**: `Button` (from `@/components/ui/button`)
      - **Props**: `variant: "ghost" size: "sm"`

**Assistant Message**:
- **Container**: `div`
  - **Props**: `className: "bg-gray-800 rounded-lg p-3 max-w-[70%] mr-auto"`
- **Message Content**: `MarkdownText` (from `@assistant-ui/markdown-text`)
  - **Props**: Content should support markdown formatting
- **Metadata**: Same structure as user message

#### Chat Input Area
- **Component**: `footer`
  - **Props**: `className: "p-4 border-t border-gray-800 flex items-end gap-2"`

**Input Field**:
- **Component**: `PromptInput` (from `@ai-elements/prompt-input`) or `Textarea` (from `@/components/ui/textarea`)
- **Props**:
  - `placeholder`: `"Ask me anything..."`
  - `className`: `"flex-1 resize-none min-h-[40px]"`
  - `onKeyDown`: Handle `Shift+Enter` for new lines, `Enter` for send
  - `rows`: `1` (should expand with content)
- **Helper Text**: `p`
  - **Props**: `className: "text-xs text-gray-500 mt-1"`
  - **Content**: `"Press Shift+Enter for a new line"`

**Send Button**:
- **Component**: `Button` (from `@/components/ui/button`)
- **Props**:
  - `type`: `"submit"`
  - `size`: `"icon"`
  - `className`: `"bg-purple-600 hover:bg-purple-700"`
- **Children**: `Send` icon (from `lucide-react`)

## Implementation Example

```tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MarkdownText } from "@assistant-ui/markdown-text";
import { Settings, Send, Copy, Edit, Trash2, ThumbsUp, ThumbsDown } from "lucide-react";
import { Sidebar } from "@/components/sidebar";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface ChatScreenProps {
  chatId: string;
  title: string;
  apiKey: string;
  messages: Message[];
  onSendMessage: (content: string) => void;
}

export function ChatScreen({
  chatId,
  title,
  apiKey,
  messages,
  onSendMessage,
}: ChatScreenProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (input.trim()) {
      onSendMessage(input.trim());
      setInput("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const truncateKey = (key: string) => {
    return `${key.substring(0, 15)}...`;
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex flex-col h-full flex-1 bg-gray-950 text-gray-50">
        {/* Header */}
        <header className="p-4 border-b border-gray-800 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold">{title}</h2>
            <p className="text-sm text-gray-400">API Key: {truncateKey(apiKey)}</p>
          </div>
          <Button variant="ghost" size="icon">
            <Settings className="h-5 w-5" />
          </Button>
        </header>

        {/* Messages */}
        <main className="flex-1 overflow-y-auto p-4 space-y-6">
          {messages.map((message) => (
            <div
              key={message.id}
              className={
                message.role === "user"
                  ? "bg-purple-800 rounded-lg p-3 max-w-[70%] ml-auto"
                  : "bg-gray-800 rounded-lg p-3 max-w-[70%] mr-auto"
              }
            >
              {message.role === "assistant" ? (
                <MarkdownText>{message.content}</MarkdownText>
              ) : (
                <p className="text-white">{message.content}</p>
              )}
              <div className="flex items-center gap-2 text-xs text-gray-400 mt-2">
                <span>{message.timestamp}</span>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                    <Copy className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                    <Trash2 className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                    <ThumbsUp className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                    <ThumbsDown className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </main>

        {/* Input */}
        <footer className="p-4 border-t border-gray-800 flex items-end gap-2">
          <div className="flex-1">
            <Textarea
              placeholder="Ask me anything..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              className="flex-1 resize-none min-h-[40px] bg-input border-border text-foreground"
            />
            <p className="text-xs text-gray-500 mt-1">Press Shift+Enter for a new line</p>
          </div>
          <Button
            type="submit"
            size="icon"
            className="bg-purple-600 hover:bg-purple-700"
            onClick={handleSend}
            disabled={!input.trim()}
          >
            <Send className="h-5 w-5" />
          </Button>
        </footer>
      </div>
    </div>
  );
}
```

## Styling Notes
- Dark theme with `bg-gray-950` for main area
- Purple accent (`bg-purple-800`) for user messages
- Gray accent (`bg-gray-800`) for assistant messages
- Purple send button (`bg-purple-600 hover:bg-purple-700`)
- Auto-scroll to bottom on new messages
- Markdown rendering for assistant messages
- Message actions (copy, edit, delete, feedback) as icon buttons

