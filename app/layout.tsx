import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Atalaia · monitor de usernames",
  description:
    "Console de rastreamento de usernames raros em Discord, TikTok, Instagram, GitHub e outras redes. Alertas em tempo real via webhook.",
  applicationName: "Atalaia",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#070808",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;450;500;600;650;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-ink-950 text-bone-100 selection:bg-lime-500/20">
        {children}
      </body>
    </html>
  );
}
