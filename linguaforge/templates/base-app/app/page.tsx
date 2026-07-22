import Link from "next/link";
import { course } from "@/lib/data";

const CONTENT_TYPE_LABEL: Record<string, string> = {
  vocabulary_list: "語彙",
  dialogue: "会話",
  grammar_note: "文法",
  reading_passage: "読解",
  pattern_drill: "パターンドリル",
};

export default function HomePage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">{course.meta.title}</h1>
        <p className="text-sm text-slate-500">レベル: {course.meta.level}</p>
      </div>
      <ul className="space-y-2">
        {course.sections.map((section) => (
          <li key={section.id}>
            <Link
              href={`/section/${section.id}`}
              className="block rounded-lg border border-slate-200 dark:border-slate-700 p-4 hover:border-slate-400 dark:hover:border-slate-500"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">
                  {section.id}. {section.title}
                </span>
                <span className="text-xs rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-1">
                  {CONTENT_TYPE_LABEL[section.content_type] ?? section.content_type}
                </span>
              </div>
              <p className="text-sm text-slate-500 mt-1">{section.items.length} 項目</p>
            </Link>
          </li>
        ))}
        {course.sections.length === 0 && (
          <p className="text-sm text-slate-500">
            まだセクションがありません。pipeline.py --input ./input --output ./output を実行してください。
          </p>
        )}
      </ul>
    </div>
  );
}
