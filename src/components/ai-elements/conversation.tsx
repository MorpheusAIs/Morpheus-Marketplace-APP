"use client";

import React, { useCallback, useContext, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowDownIcon } from "lucide-react";
import type { ComponentProps } from "react";

// Simple stick-to-bottom implementation
interface StickToBottomContext {
  isAtBottom: boolean;
  scrollToBottom: () => void;
}

const StickToBottomContext = React.createContext<StickToBottomContext | null>(null);

export type ConversationProps = ComponentProps<"div">;

export const Conversation = ({ className, ...props }: ConversationProps) => {
  const [isAtBottom, setIsAtBottom] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    containerRef.current?.scrollTo({
      top: containerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const checkScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const atBottom = scrollHeight - scrollTop - clientHeight < 10;
      setIsAtBottom(atBottom);
    };

    container.addEventListener("scroll", checkScroll);
    const observer = new MutationObserver(() => {
      checkScroll();
      if (isAtBottom) {
        scrollToBottom();
      }
    });

    observer.observe(container, { childList: true, subtree: true });
    checkScroll();

    return () => {
      container.removeEventListener("scroll", checkScroll);
      observer.disconnect();
    };
  }, [isAtBottom, scrollToBottom]);

  return (
    <StickToBottomContext.Provider value={{ isAtBottom, scrollToBottom }}>
      <div
        ref={containerRef}
        className={cn("relative flex-1 overflow-y-auto", className)}
        role="log"
        {...props}
      />
    </StickToBottomContext.Provider>
  );
};

export type ConversationContentProps = ComponentProps<"div">;

export const ConversationContent = ({ className, ...props }: ConversationContentProps) => (
  <div className={cn("flex flex-col gap-8 px-8 md:px-12 lg:px-16 py-4", className)} {...props} />
);

export type ConversationEmptyStateProps = ComponentProps<"div"> & {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
};

export const ConversationEmptyState = ({
  className,
  title = "No messages yet",
  description = "Start a conversation to see messages here",
  icon,
  children,
  ...props
}: ConversationEmptyStateProps) => (
  <div
    className={cn(
      "flex size-full flex-col items-center justify-center gap-3 p-8 text-center",
      className
    )}
    {...props}
  >
    {children ?? (
      <>
        {icon && <div className="text-muted-foreground">{icon}</div>}
        <div className="space-y-1">
          <h3 className="font-medium text-sm">{title}</h3>
          {description && <p className="text-muted-foreground text-sm">{description}</p>}
        </div>
      </>
    )}
  </div>
);

export type ConversationScrollButtonProps = ComponentProps<typeof Button>;

export const ConversationScrollButton = ({ className, ...props }: ConversationScrollButtonProps) => {
  const context = useContext(StickToBottomContext);
  if (!context) return null;

  const { isAtBottom, scrollToBottom } = context;

  const handleScrollToBottom = useCallback(() => {
    scrollToBottom();
  }, [scrollToBottom]);

  if (isAtBottom) return null;

  return (
    <Button
      className={cn(
        "absolute bottom-4 left-1/2 -translate-x-1/2 z-50 rounded-full",
        "bg-gray-800 hover:bg-gray-700 border-gray-600 text-white",
        "shadow-lg backdrop-blur-sm",
        className
      )}
      onClick={handleScrollToBottom}
      size="icon"
      type="button"
      variant="outline"
      {...props}
    >
      <ArrowDownIcon className="size-4" />
    </Button>
  );
};

