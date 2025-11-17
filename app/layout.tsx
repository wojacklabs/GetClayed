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

export const metadata: Metadata = {
  metadataBase: new URL('https://getclayed.vercel.app'),
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
        url: '/api/og',
        width: 1200,
        height: 630,
        alt: 'GetClayed - 3D Clay Sculpting',
      }
    ],
    url: '/',
    siteName: 'GetClayed',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: "GetClayed - 3D Clay Sculpting",
    description: "Create and sculpt 3D clay objects in your browser",
    images: ['/api/og'],
  },
  other: {
    'fc:frame': 'vNext',
    'fc:frame:image': 'https://getclayed.vercel.app/api/og',
    'fc:frame:image:aspect_ratio': '1.91:1',
    'fc:frame:button:1': 'Launch GetClayed',
    'fc:frame:button:1:action': 'link',
    'fc:frame:button:1:target': 'https://getclayed.vercel.app',
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
        {/* Farcaster Frame Meta Tags */}
        <meta property="fc:frame" content="vNext" />
        <meta property="fc:frame:image" content="https://getclayed.vercel.app/api/og" />
        <meta property="fc:frame:image:aspect_ratio" content="1.91:1" />
        <meta property="fc:frame:button:1" content="Launch GetClayed" />
        <meta property="fc:frame:button:1:action" content="link" />
        <meta property="fc:frame:button:1:target" content="https://getclayed.vercel.app" />
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
