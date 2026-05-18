import { notFound } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { ensureDefaultDesign, getDesign } from "@/app/lib/design-store";
import { detectLocale, pickLocalized, type Locale } from "@/app/lib/i18n";
import ExperimentRunner from "@/app/experiment/ExperimentRunner";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const design = id === "default" ? await ensureDefaultDesign() : await getDesign(id);
  if (!design) {
    return { title: "Experiment not found", robots: { index: false } };
  }
  const title = pickLocalized(design.title, design.defaultLocale);
  const description = pickLocalized(design.description, design.defaultLocale);
  return {
    title: `${title} · Go-on Lab`,
    description,
    robots: { index: false, follow: false },
  };
}

export default async function Page({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const design = id === "default" ? await ensureDefaultDesign() : await getDesign(id);
  if (!design) {
    notFound();
  }
  if (design.status === "closed") {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <div className="text-5xl mb-4">🔒</div>
          <h1 className="text-xl font-bold mb-2">この実験は現在受付を終了しています</h1>
          <p className="text-sm text-slate-400">
            研究担当者にお問い合わせください。
          </p>
        </div>
      </div>
    );
  }

  const h = await headers();
  const acceptLang = h.get("accept-language");
  const requested = typeof sp.lang === "string" ? sp.lang : null;
  let locale: Locale;
  if (design.forceLocale) {
    locale = design.forceLocale;
  } else if (
    requested &&
    (["ja", "en", "ko", "zh"] as Locale[]).includes(requested as Locale) &&
    design.enabledLocales.includes(requested as Locale)
  ) {
    locale = requested as Locale;
  } else {
    locale = detectLocale(
      acceptLang,
      design.enabledLocales,
      design.defaultLocale,
    );
  }

  return <ExperimentRunner design={design} initialLocale={locale} />;
}
