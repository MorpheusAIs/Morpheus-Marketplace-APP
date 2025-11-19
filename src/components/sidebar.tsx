"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sidebar as ShadcnSidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuAction,
  SidebarRail,
} from "@/components/ui/sidebar";
import {
  Key,
  MessageSquare,
  FlaskConical,
  FileText,
  ExternalLink,
  Trash2,
  ChevronRight,
  SquarePen,
} from "lucide-react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXTwitter } from "@fortawesome/free-brands-svg-icons";
import { useCognitoAuth } from "@/lib/auth/CognitoAuthContext";
import { useConversationHistory } from "@/lib/hooks/use-conversation-history";
import { useConversation } from "@/lib/ConversationContext";
import { useNotification } from "@/lib/NotificationContext";
import { NavUser } from "@/components/nav-user";
import { DiscordIcon } from "@/components/discord-icon";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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
  const { error } = useNotification();
  const isChatRoute = pathname?.startsWith("/chat");
  const { conversations, isLoading: conversationsLoading, getConversationById } = useConversationHistory();
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

  const handleChatSelect = async (chatId: string) => {
    try {
      // First check if conversation is already preloaded in state
      const preloadedConversation = getConversationById(chatId);
      
      if (preloadedConversation && preloadedConversation.messages && preloadedConversation.messages.length > 0) {
        // Use preloaded conversation - just navigate, no need to fetch
        console.log(`Using preloaded conversation ${chatId} with ${preloadedConversation.messages.length} messages`);
        onChatSelect?.(chatId);
        router.push(`/chat/${chatId}`);
      } else {
        // Conversation not preloaded or missing messages, fetch it
        console.log(`Conversation ${chatId} not preloaded, fetching...`);
        const conversation = await loadConversation(chatId);
        if (conversation) {
          onChatSelect?.(chatId);
          router.push(`/chat/${chatId}`);
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load conversation';
      error(
        'Load Failed',
        errorMessage,
        {
          duration: 5000
        }
      );
      console.error('Error loading conversation:', err);
    }
  };

  const handleDeleteChat = async (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (window.confirm('Are you sure you want to delete this conversation?')) {
      try {
        await deleteConversationById(chatId);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to delete conversation';
        error(
          'Delete Failed',
          errorMessage,
          {
            duration: 5000
          }
        );
        console.error('Error deleting conversation:', err);
      }
    }
  };

  return (
    <ShadcnSidebar collapsible="offcanvas" variant="sidebar" className="border-r border-sidebar-border">
      <SidebarHeader className="p-4">
        <div className="flex items-center space-x-3">
          <Image
            src="/images/Morpheus Logo - White.svg"
            alt="App Logo"
            width={32}
            height={32}
            className="h-8 w-8"
          />
          <span className="text-lg font-semibold text-sidebar-foreground">API Gateway Admin</span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {/* API Keys */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === "/api-keys"}>
                  <Link href="/api-keys">
                    <Key className="h-4 w-4" />
                    <span>API Keys</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Chat with Collapsible */}
              <Collapsible open={isHistoryExpanded} onOpenChange={setIsHistoryExpanded}>
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton isActive={isChatRoute}>
                      <MessageSquare className="h-4 w-4" />
                      <span>Chat</span>
                      <ChevronRight className="ml-auto h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                </SidebarMenuItem>
                <CollapsibleContent>
                  <div className="space-y-1 px-2 py-1">
                    <SidebarMenuItem>
                      <SidebarMenuButton onClick={handleNewChat}>
                        <SquarePen className="h-4 w-4" />
                        <span>New Chat</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>

                    <div className="flex items-center justify-between gap-2 px-2 py-2 border-t border-sidebar-border">
                      <Label htmlFor="save-chat-history" className="flex-1 text-sm text-sidebar-foreground/70">
                        Save chat history
                      </Label>
                      <Switch
                        id="save-chat-history"
                        checked={localSaveChatHistory}
                        onCheckedChange={handleSaveChatHistoryChange}
                      />
                    </div>

                    {localSaveChatHistory && (
                      <div className="border-t border-sidebar-border pt-2">
                        {conversationsLoading ? (
                          <div className="text-sm text-sidebar-foreground/50 text-center py-4">Loading conversations...</div>
                        ) : conversations.length > 0 ? (
                          <ScrollArea className="h-[200px]">
                            <div className="space-y-1 pr-2">
                              {conversations.map((chat) => {
                                const isActive = currentConversationId === chat.id;
                                const truncatedTitle = chat.title.length > 40 
                                  ? `${chat.title.substring(0, 40)}...` 
                                  : chat.title;
                                return (
                                  <SidebarMenuItem key={chat.id}>
                                    <SidebarMenuButton
                                      isActive={isActive}
                                      onClick={() => handleChatSelect(chat.id)}
                                      className="group/chat-item conversation-history-item focus-visible:ring-0 focus-visible:ring-transparent"
                                    >
                                      <span className={`flex-1 text-left min-w-0 overflow-hidden truncate transition-colors ${isActive ? 'text-green-500' : 'text-sidebar-foreground/70 hover:text-white'}`} title={chat.title}>
                                        {truncatedTitle}
                                      </span>
                                    </SidebarMenuButton>
                                    <SidebarMenuAction
                                      onClick={(e) => handleDeleteChat(chat.id, e)}
                                      showOnHover
                                    >
                                      <Trash2 className="h-4 w-4 text-sidebar-foreground/50 hover:text-red-400" />
                                    </SidebarMenuAction>
                                  </SidebarMenuItem>
                                );
                              })}
                            </div>
                          </ScrollArea>
                        ) : (
                          <div className="text-sm text-sidebar-foreground/50 text-center py-4">No conversations yet</div>
                        )}
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Test */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === "/test"}>
                  <Link href="/test">
                    <FlaskConical className="h-4 w-4" />
                    <span>Test</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Docs */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="https://apidocs.mor.org?utm_source=api-admin" target="_blank" rel="noopener noreferrer">
                    <FileText className="h-4 w-4" />
                    <span>Docs</span>
                    <ExternalLink className="ml-auto h-4 w-4" />
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-sidebar-border">
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
                className="text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors"
                aria-label="X (formerly Twitter)"
              >
                <FontAwesomeIcon icon={faXTwitter} className="h-4 w-4" />
              </Link>
              <Link
                href="https://discord.gg/GpEwTnhW"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors"
                aria-label="Discord"
              >
                <DiscordIcon className="h-4 w-4" />
              </Link>
              <Link
                href="https://mor.org?utm_source=api-admin"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors text-sm"
              >
                Website
              </Link>
            </div>
          </>
        )}
      </SidebarFooter>
      <SidebarRail />
    </ShadcnSidebar>
  );
}

