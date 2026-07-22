import { notFound } from "next/navigation";
import { course, getSection } from "@/lib/data";
import SectionView from "@/components/SectionView";

export function generateStaticParams() {
  return course.sections.map((s) => ({ id: s.id }));
}

export default function SectionPage({ params }: { params: { id: string } }) {
  const section = getSection(params.id);
  if (!section) notFound();
  return <SectionView section={section} />;
}
