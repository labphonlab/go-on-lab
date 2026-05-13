import Link from "next/link";

const modes = [
  {
    href: "/shadowing",
    title: "Shadowing",
    titleJa: "シャドーイング",
    desc: "ネイティブ音声を聴き、影のように追いかけて発音する。リスニング筋とスピーキング筋を同時に鍛える。",
    accent: "from-emerald-500 to-teal-400",
    badge: "Listening × Speaking",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
        <path d="M3 12h2l3-8 4 16 3-12 2 4h4" />
      </svg>
    ),
  },
  {
    href: "/composition",
    title: "Instant Composition",
    titleJa: "瞬間英作文",
    desc: "日本語を見て、即座に英語に組み立てる。中学・高校文法の引き出しを反射神経レベルにまで高める。",
    accent: "from-indigo-500 to-violet-400",
    badge: "Output × Reflex",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4Z" />
      </svg>
    ),
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center px-5 py-10 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/15 rounded-full blur-[120px]" />
      </div>

      <header className="w-full max-w-md flex flex-col items-center mt-4 mb-10">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-400 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20 rotate-3">
            <span className="font-black text-white text-2xl tracking-tighter">Go</span>
          </div>
          <h1 className="text-3xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
            Go-on Lab<span className="text-emerald-400">.</span>
          </h1>
        </div>
        <p className="text-[10px] text-slate-500 font-bold tracking-[0.4em] uppercase mt-2">
          English Training Cockpit
        </p>
      </header>

      <main className="w-full max-w-md flex-1 flex flex-col gap-5">
        <section className="bg-slate-800/50 backdrop-blur-xl rounded-3xl border border-slate-700/50 p-6">
          <p className="text-emerald-400 italic text-lg font-bold mb-2">&ldquo;Go on to your goal.&rdquo;</p>
          <p className="text-slate-400 text-sm leading-relaxed">
            あなたの英語を <span className="text-white font-semibold">「聴ける」</span> から
            <span className="text-white font-semibold">「話せる」</span> へ。
            2つのトレーニングモードで、インプットとアウトプットを毎日まわす。
          </p>
        </section>

        <nav className="flex flex-col gap-4">
          {modes.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className="group relative bg-slate-800/50 backdrop-blur-xl rounded-3xl border border-slate-700/50 p-6 transition-all hover:border-emerald-500/40 hover:bg-slate-800/80 active:scale-[0.99]"
            >
              <div className="flex items-start gap-4">
                <div className={`shrink-0 w-14 h-14 bg-gradient-to-br ${m.accent} rounded-2xl flex items-center justify-center text-white shadow-lg`}>
                  {m.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-slate-500 mb-1">{m.badge}</p>
                  <h2 className="text-lg font-black text-white leading-tight">{m.titleJa}</h2>
                  <p className="text-[11px] text-slate-500 font-semibold tracking-widest uppercase mb-3">{m.title}</p>
                  <p className="text-xs text-slate-400 leading-relaxed">{m.desc}</p>
                </div>
              </div>
              <span className="absolute top-5 right-5 text-slate-500 group-hover:text-emerald-400 transition-colors">→</span>
            </Link>
          ))}
        </nav>

        <Link
          href="/forecast"
          className="text-center text-[11px] text-slate-500 hover:text-emerald-400 uppercase tracking-[0.3em] py-3 transition-colors"
        >
          TOEIC スコア予測診断 →
        </Link>
      </main>

      <footer className="w-full max-w-md mt-10 flex flex-col items-center gap-3">
        <p className="text-[9px] text-slate-500 uppercase tracking-[0.4em] opacity-60">
          Data Driven English Lab.
        </p>
        <div className="h-px w-8 bg-slate-700" />
        <p className="text-[9px] text-slate-600 font-bold uppercase tracking-[0.2em]">
          © 2026 Go-on Lab.
        </p>
      </footer>
    </div>
  );
}
