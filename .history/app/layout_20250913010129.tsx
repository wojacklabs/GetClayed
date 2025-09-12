import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GetClayed - 3D Clay Sculpting",
  description: "Create and sculpt 3D clay objects in your browser",
  icons: {
    icon: [
      { url: '/favicon.png', type: 'image/png' },
      { url: '/clay.png', type: 'image/png' }
    ],
    shortcut: [{ url: '/favicon.png', type: 'image/png' }],
    apple: [{ url: '/clay.png', type: 'image/png' }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
