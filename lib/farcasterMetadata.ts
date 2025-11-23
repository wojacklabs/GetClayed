import { Metadata } from 'next';

// Farcaster Mini App 메타 태그 생성 유틸리티
export interface FarcasterEmbedButton {
  title: string;
  action: {
    type: 'launch_miniapp';
    url: string;
  };
}

export interface FarcasterEmbed {
  version: string;
  imageUrl: string;
  button: FarcasterEmbedButton;
}

export function generateFarcasterMetadata(
  title: string,
  description: string,
  imageUrl: string,
  url: string
): Metadata {
  const embed: FarcasterEmbed = {
    version: '1',
    imageUrl,
    button: {
      title: 'Open in GetClayed',
      action: {
        type: 'launch_miniapp',
        url
      }
    }
  };

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [imageUrl],
      url,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imageUrl],
    },
    other: {
      'fc:miniapp': JSON.stringify(embed),
    },
  };
}

// 기본 앱 정보
export const DEFAULT_APP_IMAGE = 'https://getclayed.io/clay.png';
export const DEFAULT_APP_URL = 'https://getclayed.io';
export const APP_NAME = 'GetClayed';
export const APP_DESCRIPTION = 'Create and sculpt 3D clay objects in your browser';

