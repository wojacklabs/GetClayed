'use client'

import { PrivyProvider } from '@privy-io/react-auth';
import { base } from 'viem/chains';

export function PrivyProviderWrapper({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId="cmeweacxn014qlg0c61fthp1h"
      config={{
        appearance: {
          theme: 'light',
          accentColor: '#3b82f6',
        },
        defaultChain: base,
        supportedChains: [base],
        embeddedWallets: {
          createOnLogin: 'users-without-wallets',
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}

