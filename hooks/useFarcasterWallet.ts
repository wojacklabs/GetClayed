'use client';

import { useEffect, useState } from 'react';
import sdk from '@farcaster/miniapp-sdk';

export function useFarcasterWallet() {
  const [isInFarcaster, setIsInFarcaster] = useState(false);
  const [farcasterAddress, setFarcasterAddress] = useState<string | null>(null);
  const [ethereumProvider, setEthereumProvider] = useState<any>(null);

  useEffect(() => {
    const initFarcasterWallet = async () => {
      try {
        // SDK 컨텍스트 확인
        const context = await sdk.context;
        
        if (context?.client?.clientFid) {
          setIsInFarcaster(true);
          
          // Ethereum Provider 가져오기
          const provider = sdk.wallet.ethProvider;
          setEthereumProvider(provider);
          
          // 현재 계정 가져오기
          try {
            const accounts = await provider.request({ 
              method: 'eth_requestAccounts' 
            });
            
            if (accounts && accounts.length > 0) {
              setFarcasterAddress(accounts[0]);
            }
          } catch (error) {
            console.log('No Farcaster wallet connected:', error);
          }
        }
      } catch (error) {
        console.log('Not in Farcaster environment:', error);
        setIsInFarcaster(false);
      }
    };

    initFarcasterWallet();
  }, []);

  return {
    isInFarcaster,
    farcasterAddress,
    ethereumProvider,
  };
}

