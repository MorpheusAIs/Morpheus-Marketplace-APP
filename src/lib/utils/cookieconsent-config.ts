import type { CookieConsentConfig } from 'vanilla-cookieconsent';
import type { ConsentMode } from './region';

const STRICT_TRANSLATIONS = {
  consentModal: {
    title: "Hello traveller, it's cookie time!",
    description:
      'We use cookies to remember your preferences and to understand how you use the Morpheus Marketplace. You can accept all categories, reject all non-essential cookies, or choose what you want to share.',
    acceptAllBtn: 'Accept all',
    acceptNecessaryBtn: 'Reject all',
    showPreferencesBtn: 'Manage preferences',
    footer:
      '<a href="/privacy">Privacy Policy</a>\n<a href="/terms">Terms and Conditions</a>',
  },
  preferencesModal: {
    title: 'Consent Preferences Center',
    acceptAllBtn: 'Accept all',
    acceptNecessaryBtn: 'Reject all',
    savePreferencesBtn: 'Save preferences',
    closeIconLabel: 'Close modal',
    serviceCounterLabel: 'Service|Services',
    sections: [
      {
        title: 'Cookie Usage',
        description:
          'We use cookies to keep the Morpheus Marketplace working, to remember your preferences, and to understand how the service is used so we can improve it.',
      },
      {
        title: 'Strictly Necessary Cookies <span class="pm__badge">Always Enabled</span>',
        description:
          'These cookies are required for the site to function — for example to keep you signed in and to remember your wallet connection. They cannot be disabled.',
        linkedCategory: 'necessary',
      },
      {
        title: 'Functionality Cookies',
        description:
          'These cookies remember your preferences (theme, language, last-used model, etc.) so the site behaves the way you expect on return visits.',
        linkedCategory: 'functionality',
      },
      {
        title: 'Analytics Cookies',
        description:
          'These cookies let us measure how the site is used (page views, button clicks, errors) so we can improve performance and reliability. They never identify you personally.',
        linkedCategory: 'analytics',
      },
      {
        title: 'More information',
        description:
          'For any question about how we use cookies or your privacy rights, see the <a class="cc__link" href="/privacy">Privacy Policy</a> or contact us.',
      },
    ],
  },
};

// California / US opt-out states: load by default, expose a "Do Not Sell or Share" exit.
const OPT_OUT_TRANSLATIONS: typeof STRICT_TRANSLATIONS = {
  consentModal: {
    title: 'Your privacy choices',
    description:
      'We use cookies and similar technologies for analytics and to improve the service. Under California (CCPA/CPRA) and similar US state laws you can opt out of the sale or sharing of your personal information at any time.',
    acceptAllBtn: 'OK',
    acceptNecessaryBtn: 'Do not sell or share my personal information',
    showPreferencesBtn: 'Manage preferences',
    footer:
      '<a href="/privacy">Privacy Policy</a>\n<a href="/terms">Terms and Conditions</a>',
  },
  preferencesModal: STRICT_TRANSLATIONS.preferencesModal,
};

export function buildCookieConsentConfig(mode: ConsentMode): CookieConsentConfig {
  const isStrict = mode === 'strict';
  const isOptOut = mode === 'opt-out';
  const isImplied = mode === 'implied';

  return {
    // Implied (rest of world): no banner, all categories accepted on init.
    autoShow: !isImplied,
    // 'opt-out' makes non-readonly categories with `enabled: true` apply by
    // default until the user explicitly rejects. 'opt-in' (default) requires
    // explicit acceptance — that's what we want for GDPR/UK GDPR/CH/BR/QC.
    mode: isStrict ? 'opt-in' : 'opt-out',
    autoClearCookies: true,
    disablePageInteraction: false,

    guiOptions: {
      consentModal: {
        layout: 'bar inline',
        position: 'bottom',
        equalWeightButtons: false,
        flipButtons: false,
      },
      preferencesModal: {
        layout: 'box',
        position: 'right',
        equalWeightButtons: false,
        flipButtons: false,
      },
    },

    categories: {
      necessary: {
        enabled: true,
        readOnly: true,
      },
      functionality: {
        // Pre-enabled outside strict regions so preference cookies just work.
        enabled: !isStrict,
      },
      analytics: {
        // Pre-enabled outside strict regions; in strict regions the user must
        // tick this category on explicitly before any GA scripts execute.
        enabled: !isStrict,
      },
    },

    language: {
      default: 'en',
      autoDetect: 'browser',
      translations: {
        en: isOptOut ? OPT_OUT_TRANSLATIONS : STRICT_TRANSLATIONS,
      },
    },
  };
}
