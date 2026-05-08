import { headers } from 'next/headers';

export type ConsentMode = 'strict' | 'opt-out' | 'implied';

export interface RegionInfo {
  country: string | null;
  region: string | null;
  consentMode: ConsentMode;
}

// Strict opt-in: prior explicit consent required before any non-essential cookies.
// EU/EEA (GDPR) + UK (UK GDPR + PECR) + Switzerland (revFADP) + Brazil (LGPD).
// Quebec (Law 25) is handled separately because it's a sub-region of CA.
const STRICT_COUNTRIES = new Set<string>([
  // EU member states
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR',
  'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK',
  'SI', 'ES', 'SE',
  // EEA non-EU
  'IS', 'LI', 'NO',
  // UK
  'GB',
  // Switzerland
  'CH',
  // Brazil (LGPD)
  'BR',
]);

// US states with consumer privacy laws that require an opt-out mechanism
// (Do Not Sell / Share) and honoring the GPC signal.
const US_OPT_OUT_STATES = new Set<string>([
  'CA', 'VA', 'CO', 'CT', 'UT', 'TX', 'OR', 'MT', 'TN', 'FL',
  'DE', 'NJ', 'IN', 'IA', 'NH', 'KY', 'MD', 'MN',
]);

function readGeoHeaders(h: Headers): { country: string | null; region: string | null } {
  // AWS CloudFront / Amplify Hosting
  let country = h.get('cloudfront-viewer-country');
  let region = h.get('cloudfront-viewer-country-region');
  // Vercel
  if (!country) country = h.get('x-vercel-ip-country');
  if (!region) region = h.get('x-vercel-ip-country-region');
  // Cloudflare
  if (!country) country = h.get('cf-ipcountry');
  if (!region) region = h.get('cf-region-code');

  return {
    country: country ? country.toUpperCase() : null,
    region: region ? region.toUpperCase() : null,
  };
}

export async function getRegionInfo(): Promise<RegionInfo> {
  const h = await headers();
  const { country, region } = readGeoHeaders(h);

  // Quebec — Law 25 is stricter than the rest of Canada.
  if (country === 'CA' && region === 'QC') {
    return { country, region, consentMode: 'strict' };
  }

  if (country && STRICT_COUNTRIES.has(country)) {
    return { country, region, consentMode: 'strict' };
  }

  if (country === 'US' && region && US_OPT_OUT_STATES.has(region)) {
    return { country, region, consentMode: 'opt-out' };
  }

  // Unknown geo (no header / VPN / dev): fail closed to strict consent.
  if (!country) {
    return { country: null, region: null, consentMode: 'strict' };
  }

  return { country, region, consentMode: 'implied' };
}
