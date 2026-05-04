import type { Metadata } from "next";
import { Inter } from "next/font/google";
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
      <head>
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
            type="text/plain"
            data-cookieconsent="statistics"
            strategy="afterInteractive"
          >
            {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${gtmId}');`}
          </Script>
        )}
        {gaId && (
          <Script
            id="gtag-base"
            src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
            type="text/plain"
            data-cookieconsent="statistics"
            strategy="afterInteractive"
          />
        )}
        {gaId && (
          <Script
            id="gtag-config"
            type="text/plain"
            data-cookieconsent="statistics"
            strategy="afterInteractive"
          >
            {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
window.gtag = gtag;
gtag('js', new Date());
gtag('config', '${gaId}');`}
          </Script>
        )}
      </head>
      <body className={inter.className}>
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
