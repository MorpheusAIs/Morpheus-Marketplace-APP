'use client';

import { useEffect } from 'react';
import 'vanilla-cookieconsent/dist/cookieconsent.css';
import { buildCookieConsentConfig } from '@/lib/utils/cookieconsent-config';
import type { ConsentMode } from '@/lib/utils/region';

interface CookieConsentProviderProps {
  mode: ConsentMode;
  country: string | null;
  region: string | null;
}

function isGpcSignaled(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    (navigator as Navigator & { globalPrivacyControl?: boolean })
      .globalPrivacyControl === true
  );
}

export function CookieConsentProvider({
  mode,
  country,
  region,
}: CookieConsentProviderProps) {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const CookieConsent = await import('vanilla-cookieconsent');
      if (cancelled) return;

      window.MorpheusConsent = { mode, country, region };

      const config = buildCookieConsentConfig(mode);
      await CookieConsent.run(config);

      // Implied (rest of world): no banner; pre-accept all categories so any
      // analytics scripts that opt in via `data-category` execute immediately.
      if (mode === 'implied') {
        CookieConsent.acceptCategory('all');
        return;
      }

      // Opt-out (US privacy-law states): if the visitor has already made a
      // choice, leave it alone. Otherwise honor a GPC signal as a binding
      // opt-out (CCPA/CPRA + most state laws); else default to accepted.
      if (mode === 'opt-out' && !CookieConsent.validConsent()) {
        if (isGpcSignaled()) {
          CookieConsent.acceptCategory(['necessary']);
        } else {
          CookieConsent.acceptCategory('all');
        }
      }
      // Strict: do nothing — wait for the user to interact with the banner.
    })();

    return () => {
      cancelled = true;
    };
  }, [mode, country, region]);

  return null;
}
