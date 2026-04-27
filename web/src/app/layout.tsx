import type { Metadata } from "next";

import { AuthBootstrap } from "@/components/auth/AuthBootstrap";

import "./globals.css";

export const metadata: Metadata = {
  title: "IFSPORT BASKETBALL AI ANALYSIS",
  description: "Next.js Tailwind v4 Setup",
  icons: {
    icon: '/icon.png', 
    shortcut: '/icon.png',
    apple: '/icon.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark"> 
      <body className="antialiased">
        <AuthBootstrap />
        {children}
      </body>
    </html>
  );
}
