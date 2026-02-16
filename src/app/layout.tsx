import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { CognitoAuthProvider } from '@/lib/auth/CognitoAuthContext';
import { ConversationProvider } from '@/lib/ConversationContext';
import { StreamManagerProvider } from '@/lib/StreamManagerContext';
import { NotificationProvider } from '@/lib/NotificationContext';
import { QueryProvider } from '@/components/providers/QueryProvider';
import { GoogleAnalytics, GoogleTagManager } from '@next/third-parties/google';
import { GTMProvider } from '@/components/providers/GTMProvider';
import { Toaster } from 'sonner';
import { BuildVersion } from '@/components/BuildVersion';
import { CoinbaseNotificationListener } from '@/components/CoinbaseNotificationListener';
import { headers } from 'next/headers';
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

  return (
    <html lang="en" className="dark">
      {gtmId && <GoogleTagManager gtmId={gtmId} />}
      <head>
        <script
          async
          crossOrigin="anonymous"
          src="https://tweakcn.com/live-preview.min.js"
        />
      </head>
      <body className={inter.className}>
        {gtmId && (
          <noscript>
            <iframe 
              src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`}
              height="0" 
              width="0" 
              style={{ display: "none", visibility: "hidden" }}
            ></iframe>
          </noscript>
        )}
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
        {gaId && <GoogleAnalytics gaId={gaId} />}
      </body>
    </html>
  );
}
