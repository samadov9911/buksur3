import type { Metadata, Viewport } from "next";
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
  title: "ORBITAL TUG — Симулятор космического буксира",
  description: "Реалистичная развлекательная и познавательная игра о космических буксирах. Доставка наноспутников и уборка космического мусора.",
  keywords: ["orbital tug", "космический буксир", "space debris", "CubeSat", "space simulator"],
  authors: [{ name: "Махди Самадов" }],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Prevent iOS bounce scroll and zoom on game screens
    <html lang="ru" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-black text-white overflow-hidden overscroll-none`}
      >
        {children}
      </body>
    </html>
  );
}
