import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from 'next/script';
import { CognitoAuthProvider } from '@/lib/auth/CognitoAuthContext';
import { ConversationProvider } from '@/lib/ConversationContext';
import { StreamManagerProvider } from '@/lib/StreamManagerContext';
import { NotificationProvider } from '@/lib/NotificationContext';
import { QueryProvider } from '@/components/providers/QueryProvider';
import { GTMProvider } from '@/components/providers/GTMProvider';
import { CookieConsentProvider } from '@/components/providers/CookieConsentProvider';
import { Toaster } from 'sonner';
import { BuildVersion } from '@/components/BuildVersion';
import { CoinbaseNotificationListener } from '@/components/CoinbaseNotificationListener';
import { getRegionInfo } from '@/lib/utils/region';
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

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

  // Strict regions: tag GA scripts so vanilla-cookieconsent blocks them
  // (rewrites type=text/plain → type=text/javascript) only when the visitor
  // accepts the analytics category. Non-strict regions: render as normal
  // executable scripts (vanilla-cookieconsent ignores scripts that don't
  // carry a `data-category` attribute, so they run on first paint).
  const consentAttrs: Record<string, string> = isStrict
    ? { type: 'text/plain', 'data-category': 'analytics' }
    : {};

  // Opt-out regions (CCPA/CPRA + similar US state laws): honor the GPC signal
  // as a legally-binding opt-out before any tag actually fires.
  const gpcGuard = isOptOut
    ? "if(typeof navigator!=='undefined'&&navigator.globalPrivacyControl===true)return;"
    : '';

  return (
    <html lang="en" className="dark">
      <head>
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
      <body className={inter.className}>
        <CookieConsentProvider mode={consentMode} country={country} region={region} />
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
