'use client';

import { PrivyProvider } from '@privy-io/react-auth';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || ''}
      config={{
        embeddedWallets: {
          createOnLogin: 'users-without-wallets',
        },
        defaultChain: 'polygon-amoy',
        supportedChains: ['polygon-amoy', 'base', 'ethereum', 'polygon'],
      }}
    >
      {children}
    </PrivyProvider>
  );
}
