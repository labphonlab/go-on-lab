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
            <header className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
              <a href="/" className="font-semibold">
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
