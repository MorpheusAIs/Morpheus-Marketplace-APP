import { NextResponse } from "next/server";

export const revalidate = 60;

const FEED_URL = "https://active.mor.org/status/feed.xml";

export type NetworkStatusLevel = "operational" | "degraded" | "outage" | "maintenance" | "unknown";

export interface NetworkStatusPayload {
  status: NetworkStatusLevel;
  label: string;
  title: string | null;
  publishedAt: string | null;
  link: string;
  fetchedAt: string;
}

function classify(title: string): NetworkStatusLevel {
  const t = title.trim().toLowerCase();
  if (t.startsWith("[resolved]") || t.startsWith("[completed]")) return "operational";
  if (t.startsWith("[investigating]") || t.startsWith("[identified]") || t.startsWith("[outage]")) return "outage";
  if (t.startsWith("[monitoring]") || t.startsWith("[degraded]")) return "degraded";
  if (t.startsWith("[maintenance]") || t.startsWith("[scheduled]")) return "maintenance";
  return "operational";
}

function labelFor(level: NetworkStatusLevel): string {
  switch (level) {
    case "operational": return "All systems operational";
    case "degraded": return "Degraded performance";
    case "outage": return "Active incident";
    case "maintenance": return "Scheduled maintenance";
    default: return "Status unknown";
  }
}

function extractTag(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? match[1].replace(/^<!\[CDATA\[|\]\]>$/g, "").trim() : null;
}

export async function GET() {
  try {
    const res = await fetch(FEED_URL, { next: { revalidate: 60 } });
    if (!res.ok) throw new Error(`feed responded ${res.status}`);
    const xml = await res.text();

    const firstItem = xml.match(/<item[\s\S]*?<\/item>/i)?.[0] ?? "";
    const title = extractTag(firstItem, "title");
    const pubDate = extractTag(firstItem, "pubDate");

    const status = title ? classify(title) : "operational";

    const payload: NetworkStatusPayload = {
      status,
      label: labelFor(status),
      title,
      publishedAt: pubDate,
      link: "https://active.mor.org/status",
      fetchedAt: new Date().toISOString(),
    };

    return NextResponse.json(payload, {
      headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=300" },
    });
  } catch {
    const payload: NetworkStatusPayload = {
      status: "unknown",
      label: "Status unavailable",
      title: null,
      publishedAt: null,
      link: "https://active.mor.org/status",
      fetchedAt: new Date().toISOString(),
    };
    return NextResponse.json(payload, { status: 200 });
  }
}
