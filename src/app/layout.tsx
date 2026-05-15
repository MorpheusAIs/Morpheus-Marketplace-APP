import type { Metadata } from "next";
import { Inter } from "next/font/google";
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
  return (
    <html lang="en" className="dark">
      <head>
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
      <body className={inter.className}>
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
