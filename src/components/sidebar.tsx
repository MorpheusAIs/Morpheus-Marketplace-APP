"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
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
  Trash2,
  ChevronDown,
  ChevronRight,
  SquarePen,
} from "lucide-react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXTwitter } from "@fortawesome/free-brands-svg-icons";
import { useCognitoAuth } from "@/lib/auth/CognitoAuthContext";
import { useConversationHistory } from "@/lib/hooks/use-conversation-history";
import { useConversation } from "@/lib/ConversationContext";
import { NavUser } from "@/components/nav-user";
import { DiscordIcon } from "@/components/discord-icon";

interface SidebarProps {
  onChatSelect?: (chatId: string) => void;
  onNewChat?: () => void;
  saveChatHistory?: boolean;
  onSaveChatHistoryChange?: (checked: boolean) => void;
}

export function Sidebar({
  onChatSelect,
  onNewChat,
  saveChatHistory = true,
  onSaveChatHistoryChange,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout, user } = useCognitoAuth();
  const isChatRoute = pathname?.startsWith("/chat");
  const { conversations } = useConversationHistory();
  const { currentConversationId, loadConversation, deleteConversationById, startNewConversation } = useConversation();
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(true);
  const [localSaveChatHistory, setLocalSaveChatHistory] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem("save_chat_history");
      return saved !== null ? saved === 'true' : saveChatHistory;
    }
    return saveChatHistory;
  });

  const handleLogout = () => {
    logout();
    router.push("/signin");
  };

  const handleAccountClick = () => {
    router.push("/account");
  };

  const handleSaveChatHistoryChange = (checked: boolean) => {
    setLocalSaveChatHistory(checked);
    localStorage.setItem("save_chat_history", checked.toString());
    onSaveChatHistoryChange?.(checked);
  };

  const handleNewChat = () => {
    startNewConversation();
    onNewChat?.();
    // Navigate to chat route if not already there
    if (!isChatRoute) {
      router.push('/chat');
    }
  };

  const handleChatSelect = (chatId: string) => {
    const conversation = loadConversation(chatId);
    if (conversation) {
      onChatSelect?.(chatId);
      // Dispatch custom event to notify chat page
      window.dispatchEvent(new CustomEvent('load-conversation', { detail: conversation }));
      // Navigate to chat route if not already there
      if (!isChatRoute) {
        router.push('/chat');
      }
    }
  };

  const handleDeleteChat = (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this conversation?')) {
      deleteConversationById(chatId);
    }
  };

  return (
    <aside className="w-[280px] flex flex-col h-full px-3 py-3">
      <div className="bg-sidebar text-gray-50 flex flex-col h-full p-4 rounded-lg border border-gray-800/50">
        {/* Header */}
        <div className="flex items-center space-x-3">
        <Image
          src="/images/Morpheus Logo - White.svg"
          alt="App Logo"
          width={32}
          height={32}
          className="h-8 w-8"
        />
        <span className="text-lg font-semibold">API Gateway Admin</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-2 mt-6">
        {/* API Keys */}
        <Link href="/api-keys">
          <Button
            variant="ghost"
            className={`w-full justify-start text-base font-normal ${
              pathname === "/api-keys" 
                ? "bg-sidebar-accent text-green-500" 
                : "text-gray-50"
            }`}
          >
            <Key className={`mr-2 h-4 w-4 ${pathname === "/api-keys" ? "text-green-500" : ""}`} />
            API Keys
          </Button>
        </Link>

        {/* Chat */}
        <div>
          <Button
            variant="ghost"
            className={`w-full justify-start text-base font-normal ${
              isChatRoute 
                ? "bg-sidebar-accent text-green-500" 
                : "text-gray-50"
            }`}
            onClick={(e) => {
              if (isChatRoute) {
                e.preventDefault();
                setIsHistoryExpanded(!isHistoryExpanded);
              } else {
                router.push("/chat");
              }
            }}
          >
            <MessageSquare className={`mr-2 h-4 w-4 ${isChatRoute ? "text-green-500" : ""}`} />
            Chat
            {isHistoryExpanded ? (
              <ChevronDown className={`ml-auto h-4 w-4 ${isChatRoute ? "text-green-500" : ""}`} />
            ) : (
              <ChevronRight className={`ml-auto h-4 w-4 ${isChatRoute ? "text-green-500" : ""}`} />
            )}
          </Button>
        </div>

        {/* Chat Section (Expanded when history is expanded) */}
        {isHistoryExpanded && (
          <div className="space-y-2 pl-4 py-2">
            <Button
              variant="ghost"
              className="w-full justify-start text-base font-normal text-gray-50"
              onClick={handleNewChat}
            >
              <SquarePen className="mr-2 h-4 w-4" />
              New Chat
            </Button>

            <div className="flex items-center justify-between gap-2 py-2 border-t border-gray-800">
              <Label htmlFor="save-chat-history" className="flex-1 text-sm">
                Save chat history
              </Label>
              <Switch
                id="save-chat-history"
                checked={localSaveChatHistory}
                onCheckedChange={handleSaveChatHistoryChange}
              />
            </div>

            {localSaveChatHistory && conversations.length > 0 && (
              <div className="border-t border-gray-800 pt-2 w-full">
                <ScrollArea className="h-[200px] w-full">
                  <div className="space-y-1 w-full pr-2">
                    {conversations.map((chat) => {
                      const isActive = currentConversationId === chat.id;
                      const truncatedTitle = chat.title.length > 40 
                        ? `${chat.title.substring(0, 40)}...` 
                        : chat.title;
                      return (
                        <div
                          key={chat.id}
                          data-conversation-item
                          className={`group relative flex items-center w-full rounded-md pl-2 pr-9 py-1.5 text-sm transition-colors cursor-pointer focus:outline-none focus:ring-0 ${
                            isActive
                              ? "bg-sidebar-accent text-green-500"
                              : "text-gray-300 hover:bg-sidebar-accent/50"
                          }`}
                          tabIndex={-1}
                        >
                          <div
                            onClick={() => handleChatSelect(chat.id)}
                            className="flex-1 text-left min-w-0 overflow-hidden truncate"
                            title={chat.title}
                          >
                            {truncatedTitle}
                          </div>
                          <button
                            onClick={(e) => handleDeleteChat(chat.id, e)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-sidebar-accent rounded z-10 flex-shrink-0 focus:outline-none focus:ring-0 focus-visible:outline-none"
                            aria-label="Delete conversation"
                            type="button"
                          >
                            <Trash2 className="h-4 w-4 text-gray-400 hover:text-red-400 transition-colors" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
        )}

        {/* Test */}
        <Link href="/test">
          <Button
            variant="ghost"
            className={`w-full justify-start text-base font-normal ${
              pathname === "/test" 
                ? "bg-sidebar-accent text-green-500" 
                : "text-gray-50"
            }`}
          >
            <FlaskConical className={`mr-2 h-4 w-4 ${pathname === "/test" ? "text-green-500" : ""}`} />
            Test
          </Button>
        </Link>

        {/* Docs */}
        <Link href="https://apidocs.mor.org" target="_blank" rel="noopener noreferrer">
          <Button variant="ghost" className="w-full justify-start text-base font-normal text-gray-50">
            <FileText className="mr-2 h-4 w-4" />
            Docs
            <ExternalLink className="ml-auto h-4 w-4" />
          </Button>
        </Link>
      </nav>

      {/* Footer */}
      <div className="mt-auto pt-4 border-t border-gray-800">
        {user && (
          <>
            <NavUser
              user={{
                name: user.name,
                email: user.email,
                avatar: "",
              }}
              onAccountClick={handleAccountClick}
              onLogout={handleLogout}
            />
            {/* Social Links */}
            <div className="flex justify-between items-center gap-3 mt-1 w-3/4 mx-auto">
              <Link
                href="https://twitter.com/MorpheusAIs"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-gray-200 transition-colors"
                aria-label="X (formerly Twitter)"
              >
                <FontAwesomeIcon icon={faXTwitter} className="h-4 w-4" />
              </Link>
              <Link
                href="https://discord.gg/GpEwTnhW"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-gray-200 transition-colors"
                aria-label="Discord"
              >
                <DiscordIcon className="h-4 w-4" />
              </Link>
              <Link
                href="https://mor.org"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-gray-200 transition-colors text-sm"
              >
                Website
              </Link>
            </div>
          </>
        )}
      </div>
      </div>
    </aside>
  );
}

