"use client";

import React, { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { CornerDownLeftIcon, Loader2Icon, SquareIcon, XIcon } from "lucide-react";
import type { ComponentProps, FormEvent } from "react";

export type PromptInputMessage = {
  text?: string;
  files?: any[];
};

export type PromptInputProps = Omit<
  ComponentProps<"form">,
  "onSubmit"
> & {
  onSubmit: (message: PromptInputMessage, event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  status?: "submitted" | "streaming" | "ready" | "error";
};

const PromptInputContext = React.createContext<{
  input: string;
  setInput: (value: string) => void;
} | null>(null);

export const PromptInput = ({
  className,
  onSubmit,
  status = "ready",
  children,
  ...props
}: PromptInputProps) => {
  const [input, setInput] = useState("");

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (input.trim()) {
      onSubmit({ text: input }, e);
      setInput("");
    }
  };

  return (
    <PromptInputContext.Provider value={{ input, setInput }}>
      <form
        className={cn(
          "relative w-full rounded-lg border border-border bg-card shadow-sm",
          className
        )}
        onSubmit={handleSubmit}
        {...props}
      >
        {children}
      </form>
    </PromptInputContext.Provider>
  );
};

export type PromptInputBodyProps = ComponentProps<"div">;

export const PromptInputBody = ({ className, ...props }: PromptInputBodyProps) => (
  <div className={cn("flex items-end gap-2 p-3", className)} {...props} />
);

export type PromptInputTextareaProps = ComponentProps<typeof Textarea>;

export const PromptInputTextarea = ({
  onChange,
  className,
  placeholder = "Ask me anything...",
  ...props
}: PromptInputTextareaProps) => {
  const context = React.useContext(PromptInputContext);
  const [isComposing, setIsComposing] = useState(false);

  if (!context) {
    throw new Error("PromptInputTextarea must be used within PromptInput");
  }

  const { input, setInput } = context;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter") {
      if (isComposing || e.nativeEvent.isComposing) {
        return;
      }
      if (e.shiftKey) {
        return;
      }
      e.preventDefault();

      const form = e.currentTarget.form;
      const submitButton = form?.querySelector(
        'button[type="submit"]'
      ) as HTMLButtonElement | null;
      if (submitButton?.disabled) {
        return;
      }

      form?.requestSubmit();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    onChange?.(e);
  };

  return (
    <Textarea
      className={cn(
        "flex-1 resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0",
        "field-sizing-content max-h-48 min-h-[60px]",
        className
      )}
      name="message"
      value={input}
      onCompositionEnd={() => setIsComposing(false)}
      onCompositionStart={() => setIsComposing(true)}
      onKeyDown={handleKeyDown}
      onChange={handleChange}
      placeholder={placeholder}
      {...props}
    />
  );
};

export type PromptInputFooterProps = ComponentProps<"div">;

export const PromptInputFooter = ({ className, ...props }: PromptInputFooterProps) => (
  <div className={cn("flex items-center justify-between gap-2 border-t border-border px-3 py-2", className)} {...props} />
);

export type PromptInputToolsProps = ComponentProps<"div">;

export const PromptInputTools = ({ className, ...props }: PromptInputToolsProps) => (
  <div className={cn("flex items-center gap-1", className)} {...props} />
);

export type PromptInputButtonProps = ComponentProps<typeof Button>;

export const PromptInputButton = ({ className, ...props }: PromptInputButtonProps) => (
  <Button
    className={cn("h-8", className)}
    size="sm"
    type="button"
    variant="ghost"
    {...props}
  />
);

export type PromptInputSubmitProps = ComponentProps<typeof Button> & {
  status?: "submitted" | "streaming" | "ready" | "error";
};

export const PromptInputSubmit = ({
  className,
  variant = "default",
  size = "icon",
  status = "ready",
  children,
  ...props
}: PromptInputSubmitProps) => {
  const context = React.useContext(PromptInputContext);
  const input = context?.input || "";

  let Icon = <CornerDownLeftIcon className="size-4" />;

  if (status === "submitted") {
    Icon = <Loader2Icon className="size-4 animate-spin" />;
  } else if (status === "streaming") {
    Icon = <SquareIcon className="size-4" />;
  } else if (status === "error") {
    Icon = <XIcon className="size-4" />;
  }

  return (
    <Button
      aria-label="Submit"
      className={cn("shrink-0", className)}
      size={size}
      type="submit"
      variant={variant}
      disabled={!input.trim() || status === "streaming"}
      {...props}
    >
      {children ?? Icon}
    </Button>
  );
};

