import { Metadata } from 'next'
import { createFarcasterEmbedTags, BASE_URL, APP_NAME } from '@/lib/farcasterMetadata'

const pageUrl = `${BASE_URL}/library`
const ogImageUrl = `${BASE_URL}/api/og?v=3` // 기본 OG 이미지 사용 (캐시 버스팅)
const title = 'Library - GetClayed'
const description = 'Browse reusable 3D clay components. Import them into your projects and earn royalties when others use your creations.'

// Farcaster 미니앱용 메타 태그 생성
const farcasterTags = createFarcasterEmbedTags({
  buttonTitle: 'Browse Library',
  targetUrl: pageUrl,
  imageUrl: ogImageUrl,
})

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title,
  description,
  openGraph: {
    title,
    description,
    images: [
      {
        url: ogImageUrl,
        width: 1200,
        height: 800,
        alt: 'GetClayed Library',
      },
    ],
    url: '/library',
    siteName: APP_NAME,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
    images: [ogImageUrl],
  },
  other: farcasterTags,
}

export default function LibraryLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}

