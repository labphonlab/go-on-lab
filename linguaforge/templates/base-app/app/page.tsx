import { course } from "@/lib/data";
import SectionCard from "@/components/SectionCard";

export default function HomePage() {
  return (
    <div className="space-y-6 animate-fade-up">
      <div className="card p-5">
        <p className="text-xs uppercase tracking-wide text-indigo-500 dark:text-indigo-400 font-medium">
          {course.meta.level}
        </p>
        <h1 className="text-xl font-bold mt-1">{course.meta.title}</h1>
        <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
          {course.sections.length} セクション・少しずつ進めましょう。
        </p>
      </div>

      <div className="space-y-3">
        {course.sections.map((section) => (
          <SectionCard key={section.id} section={section} />
        ))}
        {course.sections.length === 0 && (
          <p className="text-sm text-stone-500">
            まだセクションがありません。pipeline.py --input ./input --output ./output を実行してください。
          </p>
        )}
      </div>
    </div>
  );
}
