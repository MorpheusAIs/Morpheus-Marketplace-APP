import type { Metadata } from "next";
import { Inter_Tight, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import Script from 'next/script';
import { CognitoAuthProvider } from '@/lib/auth/CognitoAuthContext';
import { ConversationProvider } from '@/lib/ConversationContext';
import { StreamManagerProvider } from '@/lib/StreamManagerContext';
import { NotificationProvider } from '@/lib/NotificationContext';
import { QueryProvider } from '@/components/providers/QueryProvider';
import { UmamiInteractionTracker } from '@/components/umami-interaction-tracker';
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
  // Region-aware consent state is exposed on `window.MorpheusConsent` for the
  // Umami session-replay script. GA / GTM tags were removed in this branch.
  const { consentMode, country, region } = await getRegionInfo();
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
          id="umami-analytics"
          src="https://umami-production-5f98.up.railway.app/script.js"
          data-website-id="9ee22931-b645-4df8-853c-5eba51bfa9e4"
          strategy="afterInteractive"
        />
        <Script
          id="umami-session-replay"
          src="https://umami-production-5f98.up.railway.app/recorder.js"
          data-website-id="9ee22931-b645-4df8-853c-5eba51bfa9e4"
          data-sample-rate="0.15"
          data-mask-level="moderate"
          data-max-duration="300000"
          strategy="afterInteractive"
        />
      </head>
      <body className={interTight.className}>
        <QueryProvider>
          <NotificationProvider>
            <UmamiInteractionTracker />
            <CognitoAuthProvider>
              <ConversationProvider>
                <StreamManagerProvider>
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
                </StreamManagerProvider>
              </ConversationProvider>
            </CognitoAuthProvider>
          </NotificationProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
