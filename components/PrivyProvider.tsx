'use client'

import { PrivyProvider } from '@privy-io/react-auth';
import { base } from 'viem/chains';
import { useEffect } from 'react';

export function PrivyProviderWrapper({ children }: { children: React.ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID || "cmeweacxn014qlg0c61fthp1h";
  
  useEffect(() => {
    console.log('[Privy] Initializing with App ID:', appId);
    console.log('[Privy] Current origin:', window.location.origin);
  }, [appId]);
  
  return (
    <PrivyProvider
      appId={appId}
      config={{
        appearance: {
          theme: 'light',
          accentColor: '#3b82f6',
        },
        defaultChain: base,
        supportedChains: [base],
        loginMethods: ['wallet', 'email'],
      }}
    >
      {children}
    </PrivyProvider>
  );
}

