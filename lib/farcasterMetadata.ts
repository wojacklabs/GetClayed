import { Metadata } from 'next';

// 기본 앱 정보
export const BASE_URL = 'https://getclayed.io';
export const DEFAULT_APP_IMAGE = 'https://getclayed.io/animated-logo.png';
export const DEFAULT_SPLASH_IMAGE = 'https://getclayed.io/animated-logo.png';
export const SPLASH_BACKGROUND_COLOR = '#000000';
export const APP_NAME = 'GetClayed';
export const APP_DESCRIPTION = 'Create and sculpt 3D clay objects in your browser';

// Farcaster Mini App embed 인터페이스
export interface FarcasterMiniAppEmbed {
  version: '1';
  imageUrl: string;
  button: {
  title: string;
  action: {
    type: 'launch_miniapp';
    url: string;
      name: string;
      splashImageUrl: string;
      splashBackgroundColor: string;
    };
  };
}

// Farcaster Frame embed (하위 호환성)
export interface FarcasterFrameEmbed {
  version: '1';
  imageUrl: string;
  button: {
    title: string;
    action: {
      type: 'launch_frame';
      url: string;
      name: string;
      splashImageUrl: string;
      splashBackgroundColor: string;
    };
  };
}

/**
 * Farcaster 미니앱용 메타 태그 객체 생성
 * fc:miniapp과 fc:frame 둘 다 포함 (하위 호환성)
 */
export function createFarcasterEmbedTags(options: {
  buttonTitle: string;
  targetUrl: string;
  imageUrl: string;
  appName?: string;
  splashImageUrl?: string;
  splashBackgroundColor?: string;
}): Record<string, string> {
  const {
    buttonTitle,
    targetUrl,
    imageUrl,
    appName = APP_NAME,
    splashImageUrl = DEFAULT_SPLASH_IMAGE,
    splashBackgroundColor = SPLASH_BACKGROUND_COLOR,
  } = options;

  // fc:miniapp (최신 스펙)
  const miniAppEmbed: FarcasterMiniAppEmbed = {
    version: '1',
    imageUrl,
    button: {
      title: buttonTitle,
      action: {
        type: 'launch_miniapp',
        url: targetUrl,
        name: appName,
        splashImageUrl,
        splashBackgroundColor,
      },
    },
  };

  // fc:frame (하위 호환성)
  const frameEmbed: FarcasterFrameEmbed = {
    version: '1',
    imageUrl,
    button: {
      title: buttonTitle,
      action: {
        type: 'launch_frame',
        url: targetUrl,
        name: appName,
        splashImageUrl,
        splashBackgroundColor,
      },
    },
  };

  return {
    'fc:miniapp': JSON.stringify(miniAppEmbed),
    'fc:frame': JSON.stringify(frameEmbed),
  };
}

/**
 * 페이지별 Farcaster 미니앱 메타데이터 생성
 * 각 페이지 layout에서 사용
 */
export function generateFarcasterPageMetadata(options: {
  title: string;
  description: string;
  imageUrl: string;
  pageUrl: string;
  buttonTitle: string;
}): Pick<Metadata, 'other'> {
  const { title, description, imageUrl, pageUrl, buttonTitle } = options;
  
  // 절대 URL 확인
  const absoluteUrl = pageUrl.startsWith('http') ? pageUrl : `${BASE_URL}${pageUrl}`;
  const absoluteImageUrl = imageUrl.startsWith('http') ? imageUrl : `${BASE_URL}${imageUrl}`;

  return {
    other: createFarcasterEmbedTags({
      buttonTitle,
      targetUrl: absoluteUrl,
      imageUrl: absoluteImageUrl,
    }),
  };
}

/**
 * 완전한 메타데이터 생성 (OG + Twitter + Farcaster)
 */
export function generateFullMetadata(options: {
  title: string;
  description: string;
  imageUrl: string;
  pageUrl: string;
  buttonTitle: string;
  siteName?: string;
  type?: 'website' | 'article' | 'profile';
}): Metadata {
  const {
    title,
    description,
    imageUrl,
    pageUrl,
    buttonTitle,
    siteName = APP_NAME,
    type = 'website',
  } = options;

  const absoluteUrl = pageUrl.startsWith('http') ? pageUrl : `${BASE_URL}${pageUrl}`;
  const absoluteImageUrl = imageUrl.startsWith('http') ? imageUrl : `${BASE_URL}${imageUrl}`;

  return {
    metadataBase: new URL(BASE_URL),
    title,
    description,
    openGraph: {
      title,
      description,
      images: [
        {
          url: absoluteImageUrl,
          width: 1200,
          height: 800,
          alt: title,
        },
      ],
      url: absoluteUrl,
      siteName,
      type,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [absoluteImageUrl],
    },
    other: createFarcasterEmbedTags({
      buttonTitle,
      targetUrl: absoluteUrl,
      imageUrl: absoluteImageUrl,
    }),
  };
}

