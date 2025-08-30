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
        // Irys testnet configuration
        defaultChain: {
          id: 'irys-testnet',
          name: 'Irys Testnet',
          network: 'irys-testnet',
          nativeCurrency: {
            decimals: 18,
            name: 'IRYS',
            symbol: 'IRYS',
          },
          rpcUrls: {
            default: {
              http: [process.env.NEXT_PUBLIC_IRYS_TESTNET_RPC || 'https://testnet-rpc.irys.xyz/v1/execution-rpc'],
            },
            public: {
              http: [process.env.NEXT_PUBLIC_IRYS_TESTNET_RPC || 'https://testnet-rpc.irys.xyz/v1/execution-rpc'],
            },
          },
          blockExplorers: {
            default: { name: 'Explorer', url: 'https://testnet.irys.xyz' },
          },
        } as any,
      }}
    >
      {children}
    </PrivyProvider>
  );
}
