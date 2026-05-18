import { notFound } from "next/navigation";
import { requireAdmin } from "@/app/lib/admin-guard";
import { getDesign } from "@/app/lib/design-store";
import { ExperimentEditor } from "./ExperimentEditor";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function Page({ params }: PageProps) {
  await requireAdmin();
  const { id } = await params;
  const design = await getDesign(id);
  if (!design) notFound();
  return <ExperimentEditor initialDesign={design} />;
}
