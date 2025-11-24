'use client'

import { PrivyProvider } from '@privy-io/react-auth';
import { base } from 'viem/chains';
import { useEffect, useState } from 'react';

export function PrivyProviderWrapper({ children }: { children: React.ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID || "cmeweacxn014qlg0c61fthp1h";
  const [isInFarcaster, setIsInFarcaster] = useState(false);
  
  useEffect(() => {
    console.log('[Privy] Initializing with App ID:', appId);
    console.log('[Privy] Current origin:', window.location.origin);
    
    // Detect if we're in Farcaster environment
    const checkFarcaster = async () => {
      try {
        // Check for Farcaster SDK
        const sdk = await import('@farcaster/miniapp-sdk');
        const context = await sdk.default.context;
        if (context?.client?.clientFid) {
          console.log('[Privy] Detected Farcaster environment');
          setIsInFarcaster(true);
        }
      } catch (error) {
        console.log('[Privy] Not in Farcaster environment');
      }
    };
    
    checkFarcaster();
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
        // Prioritize Farcaster login when in Farcaster environment
        loginMethods: isInFarcaster 
          ? ['farcaster', 'wallet', 'email']
          : ['wallet', 'email', 'farcaster'],
      }}
    >
      {children}
    </PrivyProvider>
  );
}
