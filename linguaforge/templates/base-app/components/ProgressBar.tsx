export default function ProgressBar({ current, total }: { current: number; total: number }) {
  const percent = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 rounded-full bg-stone-100 dark:bg-stone-800">
        <div
          className="h-1.5 rounded-full bg-indigo-500 transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="shrink-0 text-xs text-stone-400 tabular-nums">
        {Math.min(current, total)} / {total}
      </span>
    </div>
  );
}
