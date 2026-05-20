"use client";

import React, { useRef, useEffect } from "react";
import { RefreshCw, Copy, GitBranch, Check, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type MessageRole = "system" | "user" | "assistant";

export interface ConversationMessage {
  id: string;
  role: MessageRole;
  content: string;
}

interface MessageBubbleProps {
  message: ConversationMessage;
  modelId?: string;
  isStreaming?: boolean;
  onContentChange: (content: string) => void;
  onRegenerate?: () => void;
  onCopy?: () => void;
  onBranch?: () => void;
  onRemove?: () => void;
  copiedId?: string | null;
}

const ROLE_CONFIG: Record<
  MessageRole,
  { label: string; initial: string; avatarClass: string; labelClass: string }
> = {
  system: {
    label: "SYSTEM",
    initial: "S",
    avatarClass: "bg-muted text-muted-foreground",
    labelClass: "text-muted-foreground",
  },
  user: {
    label: "USER",
    initial: "U",
    avatarClass: "bg-primary/20 text-primary",
    labelClass: "text-primary",
  },
  assistant: {
    label: "ASSISTANT",
    initial: "A",
    avatarClass: "bg-muted text-foreground",
    labelClass: "text-foreground",
  },
};

export function MessageBubble({
  message,
  modelId,
  isStreaming,
  onContentChange,
  onRegenerate,
  onCopy,
  onBranch,
  onRemove,
  copiedId,
}: MessageBubbleProps) {
  const cfg = ROLE_CONFIG[message.role];
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [message.content]);

  const isCopied = copiedId === message.id;

  return (
    <div className="group flex flex-col gap-2">
      {/* Header row */}
      <div className="flex items-center gap-2">
        {/* Avatar */}
        <span
          className={cn(
            "inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold shrink-0",
            cfg.avatarClass
          )}
        >
          {cfg.initial}
        </span>

        {/* Role label */}
        <span
          className={cn(
            "text-xs font-semibold tracking-widest uppercase",
            cfg.labelClass
          )}
        >
          {cfg.label}
        </span>

        {/* Model id on assistant */}
        {message.role === "assistant" && modelId && (
          <span className="ml-auto text-xs font-mono text-muted-foreground truncate max-w-[180px]">
            {modelId}
          </span>
        )}

        {/* Remove button (user/system only) */}
        {message.role !== "assistant" && onRemove && (
          <button
            onClick={onRemove}
            className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
            aria-label="Remove message"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Content */}
      <div
        className={cn(
          "rounded border border-border bg-card relative",
          message.role === "system" && "border-dashed",
          message.role === "user" && "border-primary/20"
        )}
      >
        <textarea
          ref={textareaRef}
          value={message.content}
          onChange={(e) => onContentChange(e.target.value)}
          placeholder={
            message.role === "system"
              ? "System prompt…"
              : message.role === "user"
              ? "User message…"
              : "Assistant response…"
          }
          rows={2}
          className={cn(
            "w-full resize-none bg-transparent px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-0 border-0 block",
            isStreaming && "opacity-80"
          )}
        />
        {isStreaming && (
          <span className="absolute bottom-2 right-3 inline-flex gap-0.5">
            {[0, 0.15, 0.3].map((d, i) => (
              <span
                key={i}
                className="w-1 h-1 rounded-full bg-primary animate-bounce"
                style={{ animationDelay: `${d}s` }}
              />
            ))}
          </span>
        )}
      </div>

      {/* Assistant actions */}
      {message.role === "assistant" && (
        <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity pl-8">
          {onRegenerate && (
            <ActionButton
              icon={<RefreshCw className="h-3 w-3" />}
              label="Regenerate"
              onClick={onRegenerate}
            />
          )}
          {onCopy && (
            <ActionButton
              icon={
                isCopied ? (
                  <Check className="h-3 w-3 text-primary" />
                ) : (
                  <Copy className="h-3 w-3" />
                )
              }
              label={isCopied ? "Copied" : "Copy"}
              onClick={onCopy}
            />
          )}
          {onBranch && (
            <ActionButton
              icon={<GitBranch className="h-3 w-3" />}
              label="Branch"
              onClick={onBranch}
            />
          )}
        </div>
      )}
    </div>
  );
}

function ActionButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
    >
      {icon}
      {label}
    </button>
  );
}
