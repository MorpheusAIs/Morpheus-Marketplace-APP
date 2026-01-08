"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
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
  SidebarRail,
} from "@/components/ui/sidebar";
import {
  Key,
  FlaskConical,
  FileText,
  ExternalLink,
} from "lucide-react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXTwitter } from "@fortawesome/free-brands-svg-icons";
import { useCognitoAuth } from "@/lib/auth/CognitoAuthContext";
import { NavUser } from "@/components/nav-user";
import { DiscordIcon } from "@/components/discord-icon";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout, user, apiKeys } = useCognitoAuth();
  const hasApiKeys = apiKeys.length > 0;

  const handleLogout = () => {
    logout();
    router.push("/signin");
  };

  const handleAccountClick = () => {
    router.push("/account");
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
                <SidebarMenuButton
                  asChild
                  isActive={pathname === "/api-keys"}
                  className={pathname === "/api-keys" ? "!text-green-500 data-[active=true]:!text-green-500 hover:!bg-white/10" : "hover:!bg-white/10"}
                >
                  <Link href="/api-keys">
                    <Key className={`h-4 w-4 ${pathname === "/api-keys" ? "text-green-500" : ""}`} />
                    <span className={pathname === "/api-keys" ? "text-green-500" : ""}>API Keys</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Test */}
              <TooltipProvider>
                <SidebarMenuItem>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="w-full">
                        {hasApiKeys ? (
                          <SidebarMenuButton
                            asChild
                            isActive={pathname === "/test"}
                            className={pathname === "/test" ? "!text-green-500 data-[active=true]:!text-green-500 hover:!bg-white/10" : "hover:!bg-white/10"}
                          >
                            <Link href="/test">
                              <FlaskConical className={`h-4 w-4 ${pathname === "/test" ? "text-green-500" : ""}`} />
                              <span className={pathname === "/test" ? "text-green-500" : ""}>Test</span>
                            </Link>
                          </SidebarMenuButton>
                        ) : (
                          <SidebarMenuButton
                            disabled
                            isActive={pathname === "/test"}
                            className={`${pathname === "/test" ? "!text-green-500 data-[active=true]:!text-green-500 hover:!bg-white/10" : "hover:!bg-white/10"} opacity-50 cursor-not-allowed`}
                          >
                            <FlaskConical className={`h-4 w-4 ${pathname === "/test" ? "text-green-500" : ""}`} />
                            <span className={pathname === "/test" ? "text-green-500" : ""}>Test</span>
                          </SidebarMenuButton>
                        )}
                      </div>
                    </TooltipTrigger>
                    {!hasApiKeys && (
                      <TooltipContent>
                        <p>Create an API key first to use Test</p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                </SidebarMenuItem>
              </TooltipProvider>

              {/* Docs */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  className="hover:!bg-white/10"
                >
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
                href="https://discord.com/invite/Dc26EFb6JK"
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
