"use client";

import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  LOCALES,
  getStoredLocale,
  setLocale,
  useLocaleReady,
  type LocaleCode,
} from "@/lib/i18n";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Initializes the locale from localStorage/browser settings once, then
 * renders the language dropdown. Manual choice persists in localStorage.
 */
export function LanguageToggle() {
  const { i18n } = useTranslation();
  const ready = useLocaleReady();

  useEffect(() => {
    if (!ready) return;
    const stored = window.localStorage.getItem("mor.locale");
    if (stored === null) {
      setLocale(getStoredLocale());
    } else {
      // Defense-in-depth: only accept known locale codes from storage.
      const allowed = LOCALES.some((l) => l.code === stored);
      setLocale(allowed ? (stored as LocaleCode) : getStoredLocale());
    }
  }, [ready]);

  const current = (i18n.resolvedLanguage || "en") as LocaleCode;
  const currentLabel = LOCALES.find((l) => l.code === current)?.label ?? "EN";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground">
          <Languages className="h-4 w-4" />
          <span className="text-xs font-medium">{currentLabel}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-72 overflow-y-auto">
        {LOCALES.map((l) => (
          <DropdownMenuItem
            key={l.code}
            onClick={() => setLocale(l.code)}
            className={l.code === current ? "bg-accent" : ""}
          >
            {l.label}
            {l.code === current && <span className="ml-auto text-muted-foreground">✓</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}