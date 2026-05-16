import type { Metadata } from "next";
import { Inter_Tight, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import Script from 'next/script';
import { CognitoAuthProvider } from '@/lib/auth/CognitoAuthContext';
import { ConversationProvider } from '@/lib/ConversationContext';
import { StreamManagerProvider } from '@/lib/StreamManagerContext';
import { NotificationProvider } from '@/lib/NotificationContext';
import { QueryProvider } from '@/components/providers/QueryProvider';
import { GTMProvider } from '@/components/providers/GTMProvider';
import { Toaster } from 'sonner';
import { BuildVersion } from '@/components/BuildVersion';
import { CoinbaseNotificationListener } from '@/components/CoinbaseNotificationListener';
import { getRegionInfo } from '@/lib/utils/region';
import "./globals.css";

const interTight = Inter_Tight({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Morpheus Inference API Admin",
  description: "Management interface for the Morpheus Inference API",
  icons: {
    icon: '/logo-black.png',
    shortcut: '/logo-black.png',
    apple: '/logo-black.png',
  },
  manifest: '/site.webmanifest',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const gaId = process.env.NEXT_PUBLIC_GA_ID;
  const gtmId = process.env.NEXT_PUBLIC_GTM_ID;
  const { consentMode, country, region } = await getRegionInfo();

  const isStrict = consentMode === 'strict';
  const isOptOut = consentMode === 'opt-out';

  // Strict regions (EU/EEA/UK/CH/BR/QC, or unknown geo): keep Cookiebot's manual
  // blocking attributes so scripts only run after the user grants consent.
  // Non-strict regions: tell Cookiebot to ignore these scripts so they execute
  // by default; for opt-out regions we still gate on the GPC signal at runtime.
  const consentAttrs: Record<string, string> = isStrict
    ? { type: 'text/plain', 'data-cookieconsent': 'statistics' }
    : { 'data-cookieconsent': 'ignore' };

  // Opt-out regions (US privacy-law states): honor Global Privacy Control as
  // a legally-binding opt-out signal. Bail out of the IIFE before any tag
  // initialization if GPC is set.
  const gpcGuard = isOptOut
    ? "if(typeof navigator!=='undefined'&&navigator.globalPrivacyControl===true)return;"
    : '';

  const consentBootstrap = `window.MorpheusConsent=${JSON.stringify({
    mode: consentMode,
    country,
    region,
  })};`;

  return (
    <html lang="en" className={`dark ${interTight.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable}`}>
      <head>
        <script
          id="morpheus-consent-bootstrap"
          dangerouslySetInnerHTML={{ __html: consentBootstrap }}
        />
        <Script
          id="Cookiebot"
          src="https://consent.cookiebot.com/uc.js"
          data-cbid="6d30a77a-4430-4cde-9119-5232de03c2c4"
          data-blockingmode="auto"
          strategy="beforeInteractive"
        />
        {gtmId && (
          <Script
            id="gtm-loader"
            strategy="afterInteractive"
            {...consentAttrs}
          >
            {`(function(){${gpcGuard}(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${gtmId}');})();`}
          </Script>
        )}
        {gaId && (
          <Script
            id="gtag-base"
            src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
            strategy="afterInteractive"
            {...consentAttrs}
          />
        )}
        {gaId && (
          <Script
            id="gtag-config"
            strategy="afterInteractive"
            {...consentAttrs}
          >
            {`(function(){${gpcGuard}window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
window.gtag = gtag;
gtag('js', new Date());
gtag('config', '${gaId}');})();`}
          </Script>
        )}
      </head>
      <body className={interTight.className}>
        <QueryProvider>
          <NotificationProvider>
            <CognitoAuthProvider>
              <ConversationProvider>
                <StreamManagerProvider>
                  <GTMProvider>
                    <Toaster
                      position="top-right"
                      expand={true}
                      closeButton={false}
                      toastOptions={{
                        className: 'custom-sonner-toast',
                      }}
                    />
                    <CoinbaseNotificationListener />
                    {children}
                    <BuildVersion />
                  </GTMProvider>
                </StreamManagerProvider>
              </ConversationProvider>
            </CognitoAuthProvider>
          </NotificationProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
