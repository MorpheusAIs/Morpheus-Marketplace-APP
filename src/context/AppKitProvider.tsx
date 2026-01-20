'use client';

import { wagmiAdapter, projectId, networks } from '@/config/appkit';
import { createAppKit } from '@reown/appkit/react';
import React, { type ReactNode } from 'react';
import { cookieToInitialState, WagmiProvider, type Config } from 'wagmi';

if (!projectId) {
  throw new Error('Project ID is not defined');
}

const metadata = {
  name: 'Morpheus Marketplace',
  description: 'Morpheus Marketplace App',
  url: 'https://app.mor.org',
  icons: ['https://app.mor.org/morpheus_wings_32x32.png']
};

createAppKit({
  adapters: [wagmiAdapter],
  projectId,
  networks,
  defaultNetwork: networks[0],
  metadata: metadata,
  features: {
    analytics: true,
    email: false, // Disable email login
    socials: [], // Disable social login
  },
  featuredWalletIds: [
    'fd20dc426fb37566d803205b19bbc1d4096b248ac04548e3cfb6b3a38bd033aa', // Coinbase Wallet
    'c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96', // MetaMask
    'e9ff15be07cc29436405bb39801a61dcde84809f98b925527a0696d7594c9985'  // Rabby
  ],
  allowUnsupportedChain: true,
  enableEIP6963: true, // Enable EIP-6963 for better wallet detection (MetaMask, Rabby, etc.)
  enableInjected: true, // Ensure injected providers (window.ethereum) are also checked
});

export function AppKitProvider({ children, cookies }: { children: ReactNode; cookies: string | null }) {
  const initialState = cookieToInitialState(wagmiAdapter.wagmiConfig as Config, cookies);

  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig as Config} initialState={initialState}>
      {children}
    </WagmiProvider>
  );
}
