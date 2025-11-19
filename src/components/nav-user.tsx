"use client";

import {
  User,
  ChevronsUpDown,
  LogOut,
} from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export function NavUser({
  user,
  onAccountClick,
  onLogout,
}: {
  user: {
    name?: string;
    email: string;
    avatar?: string;
  };
  onAccountClick?: () => void;
  onLogout?: () => void;
}) {
  const isMobile = useIsMobile();
  
  // Get first letter of email for avatar fallback
  const avatarFallback = user.email.charAt(0).toUpperCase();
  
  // Use name if available, otherwise use email prefix
  const displayName = user.name || user.email.split('@')[0];

  // Mobile view: Show menu items directly in sidebar
  if (isMobile) {
    return (
      <div className="space-y-1">
        {/* User Info */}
        <div className="flex items-center gap-2 px-2 py-2">
          <Avatar className="h-8 w-8 rounded-lg">
            <AvatarImage src={user.avatar} alt={displayName} />
            <AvatarFallback className="rounded-lg bg-green-600 text-white">
              {avatarFallback}
            </AvatarFallback>
          </Avatar>
          <div className="grid flex-1 text-left text-sm leading-tight min-w-0">
            <span className="truncate font-medium text-sidebar-foreground">{displayName}</span>
            <span className="truncate text-xs text-sidebar-foreground/70">{user.email}</span>
          </div>
        </div>
        
        {/* Account Menu Item */}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => onAccountClick?.()} className="w-full justify-start">
              <User className="h-4 w-4" />
              <span>Account</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          
          {/* Log out Menu Item */}
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => onLogout?.()} className="w-full justify-start">
              <LogOut className="h-4 w-4" />
              <span>Log out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </div>
    );
  }

  // Desktop view: Show dropdown menu (original behavior)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="w-full justify-start h-auto py-2 px-2 hover:bg-gray-800"
        >
          <Avatar className="h-8 w-8 rounded-lg">
            <AvatarImage src={user.avatar} alt={displayName} />
            <AvatarFallback className="rounded-lg bg-green-600 text-white">
              {avatarFallback}
            </AvatarFallback>
          </Avatar>
          <div className="grid flex-1 text-left text-sm leading-tight ml-2">
            <span className="truncate font-medium">{displayName}</span>
            <span className="truncate text-xs text-gray-400">{user.email}</span>
          </div>
          <ChevronsUpDown className="ml-auto h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-56 rounded-lg"
        side="right"
        align="end"
        sideOffset={4}
      >
        <DropdownMenuLabel className="p-0 font-normal">
          <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
            <Avatar className="h-8 w-8 rounded-lg">
              <AvatarImage src={user.avatar} alt={displayName} />
              <AvatarFallback className="rounded-lg bg-green-600 text-white">
                {avatarFallback}
              </AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{displayName}</span>
              <span className="truncate text-xs">{user.email}</span>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={onAccountClick}>
            <User className="mr-2 h-4 w-4" />
            Account
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

