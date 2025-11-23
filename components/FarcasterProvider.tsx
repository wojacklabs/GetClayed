'use client';

import { useEffect, useState } from 'react';
import sdk from '@farcaster/miniapp-sdk';

export function FarcasterProvider({ children }: { children: React.ReactNode }) {
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        // SDK 컨텍스트 가져오기
        const context = await sdk.context;
        console.log('Farcaster SDK context:', context);
        
        // 앱이 준비되었음을 알림 (스플래시 스크린 숨김)
        // disableNativeGestures 옵션 포함 가능
        sdk.actions.ready({
          // disableNativeGestures: true, // SDK 버전에 따라 사용 가능
        });
        setIsSDKLoaded(true);
      } catch (error) {
        console.error('Failed to load Farcaster SDK:', error);
        // SDK가 없어도 앱은 정상 동작해야 함
        setIsSDKLoaded(true);
      }
    };

    load();
  }, []);

  return <>{children}</>;
}

