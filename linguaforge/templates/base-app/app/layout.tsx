import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SettingsProvider } from "@/lib/settings";
import { course } from "@/lib/data";
import SettingsBar from "@/components/SettingsBar";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";

export const metadata: Metadata = {
  title: course.meta.title,
  description: `${course.meta.title} — LinguaForge generated learning app`,
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: course.meta.title,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf9f7" },
    { media: "(prefers-color-scheme: dark)", color: "#15181d" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <ServiceWorkerRegistration />
        <SettingsProvider>
          <div className="mx-auto max-w-2xl min-h-screen flex flex-col">
            <header className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-stone-200/80 dark:border-stone-800/80 bg-canvas-light/90 dark:bg-canvas-dark/90 backdrop-blur">
              <a href="/" className="font-semibold tracking-tight">
                {course.meta.title}
              </a>
              <SettingsBar />
            </header>
            <main className="flex-1 px-4 py-6">{children}</main>
          </div>
        </SettingsProvider>
      </body>
    </html>
  );
}
