import { headers } from 'next/headers';
import { AppKitProvider } from '@/context/AppKitProvider';

export default async function BillingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersObj = await headers();
  const cookies = headersObj.get('cookie');

  return (
    <AppKitProvider cookies={cookies}>
      {children}
    </AppKitProvider>
  );
}
