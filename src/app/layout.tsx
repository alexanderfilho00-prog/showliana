import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond } from "next/font/google";
import "./globals.css";

const serif = Cormorant_Garamond({
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--sl-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Showliana",
  description: "A agenda de bolso da Jú. Tarefas, compromissos e clientes num só lugar.",
  manifest: "/manifest.webmanifest",
  applicationName: "Showliana",
  appleWebApp: {
    capable: true,
    title: "Showliana",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F3EEE4" },
    { media: "(prefers-color-scheme: dark)", color: "#1E1C1B" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={serif.variable}>
      <body className="sl-body">{children}</body>
    </html>
  );
}
