import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { PopupNotificationProvider } from "../components/PopupNotification";
import { PrivyProviderWrapper } from "../components/PrivyProvider";
import { FarcasterProvider } from "../components/FarcasterProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Farcaster Mini App embed configuration
const miniAppEmbed = {
  version: "1",
  imageUrl: "https://getclayed.io/animated-logo.png",
  aspectRatio: "1:1",
  button: {
    title: "No Blender, Just Clay",
    action: {
      type: "launch_miniapp",
      url: "https://getclayed.io",
      name: "GetClayed",
      splashImageUrl: "https://getclayed.io/animated-logo.png",
      splashBackgroundColor: "#000000"
    }
  }
};

// For backward compatibility
const frameEmbed = {
  version: "1",
  imageUrl: "https://getclayed.io/animated-logo.png",
  aspectRatio: "1:1",
  button: {
    title: "No Blender, Just Clay",
    action: {
      type: "launch_frame",
      url: "https://getclayed.io",
      name: "GetClayed",
      splashImageUrl: "https://getclayed.io/animated-logo.png",
      splashBackgroundColor: "#000000"
    }
  }
};

// OG 이미지 URL (캐시 버스팅 포함)
const OG_IMAGE_URL = 'https://getclayed.io/api/og?v=3';

export const metadata: Metadata = {
  metadataBase: new URL('https://getclayed.io'),
  title: "GetClayed - 3D Clay Sculpting",
  description: "Create and sculpt 3D clay objects in your browser",
  icons: {
    icon: [
      { url: '/animated-logo.png', type: 'image/png' },
      { url: '/favicon.png', type: 'image/png' },
      { url: '/clay.png', type: 'image/png' }
    ],
    shortcut: [{ url: '/animated-logo.png', type: 'image/png' }],
    apple: [{ url: '/animated-logo.png', type: 'image/png' }],
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'GetClayed',
  },
  openGraph: {
    title: "GetClayed - 3D Clay Sculpting",
    description: "Create and sculpt 3D clay objects in your browser",
    images: [
      {
        url: OG_IMAGE_URL,
        width: 1200,
        height: 800,
        alt: 'GetClayed - 3D Clay Sculpting',
        type: 'image/png',
      }
    ],
    url: 'https://getclayed.io',
    siteName: 'GetClayed',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: "GetClayed - 3D Clay Sculpting",
    description: "Create and sculpt 3D clay objects in your browser",
    images: [OG_IMAGE_URL],
    site: '@getclayed',
  },
  other: {
    // New Farcaster Mini App spec
    'fc:miniapp': JSON.stringify(miniAppEmbed),
    // For backward compatibility
    'fc:frame': JSON.stringify(frameEmbed),
  }
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#3b82f6',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Farcaster Mini App is handled by metadata.other */}
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <FarcasterProvider>
          <PrivyProviderWrapper>
            <PopupNotificationProvider>
              {children}
            </PopupNotificationProvider>
          </PrivyProviderWrapper>
        </FarcasterProvider>
      </body>
    </html>
  );
}
