"use client";

import React, { useState } from 'react';

// --- ロジック：Go-on Lab 推定エンジン ---
const estimateCurrentScore = (correctCount: number): number => {
  const accuracy = correctCount / 5; 
  const estimated = 200 + (accuracy * 700);
  return Math.round(estimated / 10) * 10;
};

const predictFutureScore = (currentScore: number, monthlyHours: number, months: number): number => {
  let factor = 2.2;
  if (currentScore >= 850) factor = 5.5;
  else if (currentScore >= 650) factor = 4.2;
  else if (currentScore >= 450) factor = 2.8;

  const totalHours = monthlyHours * months;
  const gain = totalHours / factor;
  return Math.min(990, Math.round((currentScore + gain) / 10) * 10);
};

const questions = [
  { id: 1, q: "The company will (  ) a new office in Tokyo.", opts: ["open", "take", "stay", "walk"], ans: 0 },
  { id: 2, q: "Please (  ) the documents by Friday.", opts: ["submit", "look", "talk", "agree"], ans: 0 },
  { id: 3, q: "All employees are (  ) to attend the meeting.", opts: ["required", "requiring", "require", "requires"], ans: 0 },
  { id: 4, q: "The CEO gave an (  ) speech yesterday.", opts: ["inspiring", "inspired", "inspire", "inspiration"], ans: 0 },
  { id: 5, q: "The project was delayed (  ) to a lack of funds.", opts: ["due", "because", "since", "while"], ans: 0 },
];

export default function GoOnLabApp() {
  const [step, setStep] = useState<'start' | 'quiz' | 'input' | 'result'>('start');
  const [currentIdx, setCurrentIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [monthlyHours, setMonthlyHours] = useState(40);
  const [months, setMonths] = useState(3);

  const handleAnswer = (idx: number) => {
    if (idx === questions[currentIdx].ans) setScore(score + 1);
    if (currentIdx < questions.length - 1) {
      setCurrentIdx(currentIdx + 1);
    } else {
      setStep('input');
    }
  };

  const estimatedScore = estimateCurrentScore(score);
  const futureScore = predictFutureScore(estimatedScore, monthlyHours, months);

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 font-sans text-slate-100 relative">
      {/* 背景装飾 */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/20 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/10 rounded-full blur-[120px]"></div>
      </div>

      <div key={`${step}-${currentIdx}`} className="max-w-md w-full animate-fade-in">
        
        {/* ロゴエリア：Go-on Lab 仕様 */}
        <div className="flex flex-col items-center justify-center mb-10 gap-1">
            <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-400 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20 rotate-3">
                    <span className="font-black text-white text-2xl tracking-tighter">Go</span>
                </div>
                <h1 className="text-3xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
                    Go-on Lab<span className="text-emerald-400">.</span>
                </h1>
            </div>
            <p className="text-[10px] text-slate-500 font-bold tracking-[0.4em] uppercase mt-2">Phonetic & Predictive Analytics</p>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-xl rounded-[2.5rem] shadow-2xl border border-slate-700/50 overflow-hidden">
          <div className="p-8">
            {step === 'start' && (
              <div className="text-center py-4">
                <h2 className="text-xl font-bold mb-4 italic text-emerald-400">&ldquo;Go on to your goal.&rdquo;</h2>
                <p className="text-slate-400 mb-8 leading-relaxed text-sm">
                  石原准教授監修の語音・統計ハイブリッドモデル。<br />
                  わずか5問で、あなたのTOEIC成長曲線を可視化します。
                </p>
                <button 
                  onClick={() => setStep('quiz')} 
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-2xl font-bold transition-all shadow-lg shadow-emerald-600/20 active:scale-[0.98]"
                >
                  解析を開始する
                </button>
              </div>
            )}

            {step === 'quiz' && (
              <div>
                <div className="w-full bg-slate-700 h-1.5 rounded-full mb-8 overflow-hidden">
                  <div 
                    className="bg-emerald-500 h-full transition-all duration-300" 
                    style={{ width: `${((currentIdx + 1) / questions.length) * 100}%` }}
                  ></div>
                </div>
                <p className="text-lg font-semibold mb-8 leading-snug min-h-[3rem]">{questions[currentIdx].q}</p>
                <div className="space-y-4">
                  {questions[currentIdx].opts.map((opt, i) => (
                    <button 
                      key={i} 
                      onClick={() => handleAnswer(i)} 
                      className="w-full text-left p-4 bg-slate-700/30 border border-slate-600/50 rounded-2xl hover:bg-slate-700/80 hover:border-emerald-500/50 transition-all active:scale-[0.98]"
                    >
                      <span className="inline-block w-8 h-8 rounded-lg bg-slate-800 text-center leading-8 mr-3 text-xs font-bold text-slate-400 uppercase">
                        {String.fromCharCode(97 + i)}
                      </span>
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 'input' && (
              <div>
                <h2 className="text-xl font-bold mb-8 text-center text-emerald-400">Condition</h2>
                <div className="space-y-10">
                  <div className="relative">
                    <label className="flex justify-between text-sm font-medium mb-4 text-slate-300">
                      <span>1ヶ月の学習時間</span>
                      <span className="text-emerald-400 font-bold">{monthlyHours}時間</span>
                    </label>
                    <input type="range" min="0" max="150" step="5" value={monthlyHours} onChange={(e) => setMonthlyHours(Number(e.target.value))} className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500" />
                  </div>
                  <div className="relative">
                    <label className="flex justify-between text-sm font-medium mb-4 text-slate-300">
                      <span>予測期間</span>
                      <span className="text-emerald-400 font-bold">{months}ヶ月後</span>
                    </label>
                    <input type="range" min="1" max="12" value={months} onChange={(e) => setMonths(Number(e.target.value))} className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500" />
                  </div>
                  <button onClick={() => setStep('result')} className="w-full bg-gradient-to-r from-emerald-600 to-teal-500 text-white py-4 rounded-2xl font-bold shadow-lg shadow-emerald-600/20 hover:scale-[1.02] transition-transform active:scale-[0.98]">
                    成長シミュレーションを実行
                  </button>
                </div>
              </div>
            )}

            {step === 'result' && (
              <div className="text-center">
                <div className="mb-10">
                  <p className="text-[10px] font-bold tracking-[0.3em] text-slate-500 uppercase mb-2">Estimated Current</p>
                  <p className="text-5xl font-black text-white">{estimatedScore}<span className="text-xl ml-1 text-slate-400 font-normal">pts</span></p>
                </div>
                
                <div className="mb-10 p-8 bg-emerald-500/10 rounded-[2rem] border border-emerald-500/30 relative">
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-[10px] font-black px-4 py-1 rounded-full uppercase tracking-widest text-white">Forecast Result</div>
                  <p className="text-slate-400 text-sm mb-2">{months}ヶ月後の期待値</p>
                  <p className="text-7xl font-black bg-clip-text text-transparent bg-gradient-to-b from-white to-emerald-400">{futureScore}</p>
                  <div className="flex items-center justify-center mt-4 gap-1">
                    <span className="text-emerald-400 font-bold">+{futureScore - estimatedScore}</span>
                    <span className="text-slate-500 text-xs ml-1 font-medium">の向上ポテンシャル</span>
                  </div>
                </div>

                <button onClick={() => window.location.reload()} className="text-slate-400 text-xs hover:text-emerald-400 transition-colors mb-8 uppercase tracking-widest">
                  ← RE-CALCULATE
                </button>
                
                <div className="pt-6 border-t border-slate-700/50">
                    <div className="p-5 bg-slate-900/50 rounded-2xl border border-slate-700">
                        <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-2 text-left">Advanced Analysis</p>
                        <p className="text-[11px] text-slate-400 leading-relaxed text-left">
                            Premiumプラン（開発中）では、石原准教授監修のAIが、あなたの音声処理能力を分析し、最短でスコアを伸ばすための個別カリキュラムを生成します。
                        </p>
                    </div>
                </div>
              </div>
            )}
          </div>
        </div>
        
        <div className="mt-10 flex flex-col items-center gap-4">
            <p className="text-center text-[9px] text-slate-500 uppercase tracking-[0.4em] opacity-50">
                Data Driven English Lab.
            </p>
            <div className="h-px w-8 bg-slate-700"></div>
            <p className="text-[9px] text-slate-600 font-bold uppercase tracking-[0.2em]">
                © 2026 Go-on Lab.
            </p>
        </div>
      </div>
    </div>
  );
}