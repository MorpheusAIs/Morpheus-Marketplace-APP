"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import i18next, { type i18n as I18nInstance } from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";

import en from "@/i18n/locales/en.json";
import ja from "@/i18n/locales/ja.json";
import ptBR from "@/i18n/locales/pt-BR.json";
import deDE from "@/i18n/locales/de-DE.json";
import frFR from "@/i18n/locales/fr-FR.json";
import es from "@/i18n/locales/es.json";
import ko from "@/i18n/locales/ko.json";
import hi from "@/i18n/locales/hi.json";
import tr from "@/i18n/locales/tr.json";
import it from "@/i18n/locales/it.json";
import pl from "@/i18n/locales/pl.json";
import ru from "@/i18n/locales/ru.json";
import zhHans from "@/i18n/locales/zh-Hans.json";

export const LOCALES = [
  { code: "en", label: "EN" },
  { code: "ja", label: "日本語" },
  { code: "pt-BR", label: "Português" },
  { code: "de-DE", label: "Deutsch" },
  { code: "fr-FR", label: "Français" },
  { code: "es", label: "Español" },
  { code: "ko", label: "한국어" },
  { code: "hi", label: "हिन्दी" },
  { code: "tr", label: "Türkçe" },
  { code: "it", label: "Italiano" },
  { code: "pl", label: "Polski" },
  { code: "ru", label: "Русский" },
  { code: "zh-Hans", label: "中文" },
] as const;

export type LocaleCode = (typeof LOCALES)[number]["code"];

const STORAGE_KEY = "mor.locale";

const RESOURCES: Record<string, { translation: Record<string, unknown> }> = {
  en: { translation: en },
  ja: { translation: ja },
  "pt-BR": { translation: ptBR },
  "de-DE": { translation: deDE },
  "fr-FR": { translation: frFR },
  es: { translation: es },
  ko: { translation: ko },
  hi: { translation: hi },
  tr: { translation: tr },
  it: { translation: it },
  pl: { translation: pl },
  ru: { translation: ru },
  "zh-Hans": { translation: zhHans },
};

let initPromise: Promise<I18nInstance> | null = null;

function initI18n(): Promise<I18nInstance> {
  if (!initPromise) {
    initPromise = i18next.use(initReactI18next).init({
      resources: RESOURCES,
      lng: "en",
      fallbackLng: "en",
      interpolation: { escapeValue: false },
      returnEmptyString: false,
      react: { useSuspense: false },
    }) as unknown as Promise<I18nInstance>;
  }
  return initPromise;
}

/** Map a browser language tag to one of our locales. */
export function resolveLocale(tag: string | undefined | null): LocaleCode {
  if (!tag) return "en";
  const lower = tag.toLowerCase();
  if (lower.startsWith("zh")) return "zh-Hans"; // Simplified only
  if (lower.startsWith("pt")) return "pt-BR";
  const base = lower.split("-")[0];
  const map: Record<string, LocaleCode> = {
    en: "en", ja: "ja", de: "de-DE", fr: "fr-FR", es: "es",
    ko: "ko", hi: "hi", tr: "tr", it: "it", pl: "pl", ru: "ru",
  };
  return map[base] ?? "en";
}

export function getStoredLocale(): LocaleCode {
  if (typeof window === "undefined") return "en";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored && LOCALES.some((l) => l.code === stored)) return stored as LocaleCode;
  // Auto-detect on first visit only; manual choice wins afterwards.
  const candidates = navigator.languages?.length
    ? navigator.languages
    : navigator.language
      ? [navigator.language]
      : [];
  for (const tag of candidates) {
    const resolved = resolveLocale(tag);
    if (resolved !== "en") return resolved;
  }
  return "en";
}

export function setLocale(code: LocaleCode): void {
  void i18next.changeLanguage(code);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, code);
    document.documentElement.lang = code;
  }
}

export function useLocaleReady(): I18nInstance | null {
  const [instance, setInstance] = useState<I18nInstance | null>(
    i18next.isInitialized ? i18next : null,
  );
  useEffect(() => {
    let cancelled = false;
    initI18n().then((i) => {
      if (!cancelled) setInstance(i);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return instance;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  return <I18nextProvider i18n={i18next}>{children}</I18nextProvider>;
}