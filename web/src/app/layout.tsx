import type { Metadata } from "next";

import { AuthBootstrap } from "@/components/auth/AuthBootstrap";
import { LanguagePreferenceProvider } from "@/components/account/LanguagePreferenceProvider";
import { initializeTheme } from "@/lib/workspaceTheme";

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
    <html lang="en" className="dark" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: initializeTheme }} />
      </head>
      <body className="antialiased">
        <AuthBootstrap />
        <LanguagePreferenceProvider>{children}</LanguagePreferenceProvider>
      </body>
    </html>
  );
}
