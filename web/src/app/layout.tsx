import type { Metadata } from "next";

import { AuthBootstrap } from "@/components/auth/AuthBootstrap";

import "./globals.css";

export const metadata: Metadata = {
  title: "Apex Sport AI — Motion Intelligence for Basketball",
  description: "AI video analysis for shooting, dribbling, and training — with performance scores and clear recommendations.",
  icons: {
    icon: "/icon.png",
    shortcut: "/icon.png",
    apple: "/icon.png",
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
