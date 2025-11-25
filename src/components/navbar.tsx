"use client";

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

interface NavbarProps {
  logoComponent?: React.ReactNode;
  appName?: string;
  externalLinkHref?: string;
  externalLinkText?: string;
  signInHref?: string;
}

export function Navbar({
  logoComponent,
  appName = "API Gateway Admin",
  externalLinkHref = "https://mor.org?utm_source=api-admin",
  externalLinkText = "mor.org",
  signInHref = "/signin",
}: NavbarProps) {
  return (
    <nav className="flex items-center justify-between h-16 px-6 bg-background text-foreground border-b border-border">
      <div className="flex items-center space-x-3">
        {logoComponent || (
          <Image
            src="/images/Morpheus Logo - White.svg"
            alt="Morpheus Logo"
            width={24}
            height={24}
            className="h-6 w-auto"
          />
        )}
        <p className="text-lg font-semibold text-foreground">{appName}</p>
      </div>
      <div className="flex items-center space-x-4">
        <Link
          href={externalLinkHref}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-muted-foreground hover:text-foreground flex items-center space-x-1"
        >
          <span>{externalLinkText}</span>
          <ExternalLink className="h-4 w-4" />
        </Link>
        <Link href={signInHref}>
          <Button variant="default" className="bg-green-500 hover:bg-green-600 text-white">
            Sign In
          </Button>
        </Link>
      </div>
    </nav>
  );
}

