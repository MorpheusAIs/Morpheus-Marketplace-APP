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
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import {
  Key,
  Play,
  Box,
  BarChart3,
  CreditCard,
  Settings,
  BookOpen,
  Tag,
  Activity,
  ExternalLink,
} from "lucide-react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXTwitter } from "@fortawesome/free-brands-svg-icons";
import { useCognitoAuth } from "@/lib/auth/CognitoAuthContext";
import { NavUser } from "@/components/nav-user";
import { DiscordIcon } from "@/components/discord-icon";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useNetworkStatus } from "@/components/network-status/use-network-status";
import { NetworkStatusDot } from "@/components/network-status/network-status-dot";
import { cn } from "@/lib/utils";

type NavItem = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  external?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  trailing?: React.ReactNode;
};

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout, user, defaultApiKey } = useCognitoAuth();
  const hasDefaultApiKey = defaultApiKey !== null;
  const network = useNetworkStatus();

  const handleLogout = () => {
    logout();
    router.push("/signin");
  };

  const handleAccountClick = () => {
    router.push("/account");
  };

  const buildItems: NavItem[] = [
    {
      label: "Playground",
      icon: Play,
      href: "/test",
      disabled: !hasDefaultApiKey,
      disabledReason:
        'A Default API key must be set and verified before using the "Playground". Go to API Keys to set your Default API Key.',
    },
    { label: "API Keys", icon: Key, href: "/api-keys" },
    {
      label: "Models",
      icon: Box,
      href: "https://apidocs.mor.org/documentation/models",
      external: true,
    },
  ];

  const monitorItems: NavItem[] = [
    { label: "Usage", icon: BarChart3, href: "/usage-analytics" },
  ];

  const accountItems: NavItem[] = [
    { label: "Billing", icon: CreditCard, href: "/billing" },
    { label: "Settings", icon: Settings, href: "/account" },
  ];

  const resourceItems: NavItem[] = [
    {
      label: "Docs",
      icon: BookOpen,
      href: "https://apidocs.mor.org?utm_source=api-admin",
      external: true,
    },
    {
      label: "Pricing",
      icon: Tag,
      href: "https://apidocs.mor.org/documentation/models/pricing",
      external: true,
    },
    {
      label: "Network Status",
      icon: Activity,
      href: "https://active.mor.org/status",
      external: true,
      trailing: network ? <NetworkStatusDot level={network.status} /> : null,
    },
  ];

  return (
    <ShadcnSidebar
      collapsible="icon"
      variant="sidebar"
      className="border-r border-sidebar-border"
    >
      <SidebarHeader className="px-3 py-4">
        <Link href="/api-keys" className="flex items-center gap-2.5">
          <Image
            src="/images/Morpheus Logo - White.svg"
            alt="Morpheus"
            width={24}
            height={24}
            className="h-6 w-6 shrink-0"
          />
          <span className="text-sm font-semibold tracking-tight text-sidebar-foreground group-data-[collapsible=icon]:hidden">
            Inference API
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <NavGroup label="Build" items={buildItems} pathname={pathname} />
        <NavGroup label="Monitor" items={monitorItems} pathname={pathname} withDivider />
        <NavGroup label="Account" items={accountItems} pathname={pathname} withDivider />
        <NavGroup
          label="Resources"
          items={resourceItems}
          pathname={pathname}
          withDivider
          tooltipExtra={(item) =>
            item.label === "Network Status" && network ? network.label : undefined
          }
        />
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        {user && (
          <>
            <NavUser
              user={{ name: user.name, email: user.email, avatar: "" }}
              onAccountClick={handleAccountClick}
              onLogout={handleLogout}
            />
            <div className="mx-auto mt-2 flex w-3/4 items-center justify-between gap-3 group-data-[collapsible=icon]:hidden">
              <Link
                href="https://twitter.com/MorpheusAIs"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sidebar-foreground/50 transition-colors hover:text-sidebar-foreground"
                aria-label="X (formerly Twitter)"
              >
                <FontAwesomeIcon icon={faXTwitter} className="h-4 w-4" />
              </Link>
              <Link
                href="https://discord.com/invite/Dc26EFb6JK"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sidebar-foreground/50 transition-colors hover:text-sidebar-foreground"
                aria-label="Discord"
              >
                <DiscordIcon className="h-4 w-4" />
              </Link>
              <Link
                href="https://mor.org?utm_source=api-admin"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-sidebar-foreground/50 transition-colors hover:text-sidebar-foreground"
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

function NavGroup({
  label,
  items,
  pathname,
  withDivider = false,
  tooltipExtra,
}: {
  label: string;
  items: NavItem[];
  pathname: string;
  withDivider?: boolean;
  tooltipExtra?: (item: NavItem) => string | undefined;
}) {
  return (
    <SidebarGroup
      className={cn(
        withDivider &&
          "border-t border-sidebar-border/60 group-data-[collapsible=icon]:mt-2 group-data-[collapsible=icon]:pt-2",
      )}
    >
      <SidebarGroupLabel className="px-2 text-[10.5px] font-medium uppercase tracking-[0.12em] text-sidebar-foreground/40">
        {label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <NavLink
              key={item.label}
              item={item}
              isActive={!item.external && pathname === item.href}
              tooltipExtra={tooltipExtra?.(item)}
            />
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

function NavLink({
  item,
  isActive,
  tooltipExtra,
}: {
  item: NavItem;
  isActive: boolean;
  tooltipExtra?: string;
}) {
  const { icon: Icon, label, href, external, disabled, disabledReason, trailing } = item;

  const tooltipText = tooltipExtra ? `${label} · ${tooltipExtra}` : label;

  const activeRail = isActive
    ? "before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[2px] before:rounded-full before:bg-primary"
    : "";

  const buttonClassName = cn(
    "relative gap-2.5",
    activeRail,
    isActive
      ? "bg-sidebar-accent text-sidebar-foreground"
      : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground",
  );

  if (disabled) {
    return (
      <TooltipProvider delayDuration={200}>
        <SidebarMenuItem>
          <Tooltip>
            <TooltipTrigger asChild>
              <SidebarMenuButton
                disabled
                tooltip={tooltipText}
                className={cn(buttonClassName, "cursor-not-allowed opacity-50")}
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </SidebarMenuButton>
            </TooltipTrigger>
            {disabledReason && (
              <TooltipContent side="right">
                <p className="max-w-[220px] text-xs">{disabledReason}</p>
              </TooltipContent>
            )}
          </Tooltip>
        </SidebarMenuItem>
      </TooltipProvider>
    );
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActive} tooltip={tooltipText} className={buttonClassName}>
        <Link
          href={href}
          {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        >
          <Icon className="h-4 w-4" />
          <span>{label}</span>
          {trailing && (
            <span className="ml-auto flex items-center group-data-[collapsible=icon]:hidden">
              {trailing}
            </span>
          )}
          {external && (
            <ExternalLink
              className={cn(
                "h-3.5 w-3.5 text-sidebar-foreground/40 group-data-[collapsible=icon]:hidden",
                trailing ? "ml-1.5" : "ml-auto",
              )}
            />
          )}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
