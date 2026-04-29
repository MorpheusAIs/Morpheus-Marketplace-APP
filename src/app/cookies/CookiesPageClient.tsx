"use client";

import Link from "next/link";
import Image from "next/image";
import Script from "next/script";
import { ArrowLeft } from "lucide-react";

export function CookiesPageClient() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link
            href="/signin"
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm font-medium">Back</span>
          </Link>
          <div className="flex items-center gap-3">
            <Image
              src="/images/mor_mark_white.png"
              alt="Morpheus Logo"
              width={24}
              height={24}
              className="h-6 w-auto"
            />
            <span className="text-lg font-semibold text-foreground">
              Morpheus Inference API
            </span>
          </div>
          <div className="w-20" />
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8 max-w-3xl">
        <h1 className="text-2xl font-bold text-foreground mt-2 mb-4">
          Cookie Policy
        </h1>
        <p className="text-muted-foreground mb-8 leading-relaxed">
          This website uses cookies. The table below is automatically generated
          by Cookiebot and lists every cookie used on this site, its purpose,
          and its duration. To change your consent at any time, use the
          &ldquo;Cookie Preferences&rdquo; link in the footer of any page.
        </p>

        <Script
          id="CookieDeclaration"
          src="https://consent.cookiebot.com/6d30a77a-4430-4cde-9119-5232de03c2c4/cd.js"
          strategy="afterInteractive"
        />

        <div className="mt-12 pt-8 border-t border-border flex flex-wrap gap-x-4 gap-y-2 justify-center text-sm">
          <Link
            href="/privacy"
            className="text-green-500 hover:text-green-400 hover:underline font-medium"
          >
            Privacy Policy
          </Link>
          <span className="text-muted-foreground">·</span>
          <Link
            href="/terms"
            className="text-green-500 hover:text-green-400 hover:underline font-medium"
          >
            Terms of Service
          </Link>
          <span className="text-muted-foreground">·</span>
          <Link
            href="/signin"
            className="text-green-500 hover:text-green-400 hover:underline font-medium"
          >
            Return to Sign in
          </Link>
        </div>
      </main>
    </div>
  );
}
