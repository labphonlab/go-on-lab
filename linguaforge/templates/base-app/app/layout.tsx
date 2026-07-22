import type { Metadata } from "next";
import "./globals.css";
import { SettingsProvider } from "@/lib/settings";
import { course } from "@/lib/data";
import SettingsBar from "@/components/SettingsBar";

export const metadata: Metadata = {
  title: course.meta.title,
  description: `${course.meta.title} — LinguaForge generated learning app`,
  manifest: "/manifest.json",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
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
