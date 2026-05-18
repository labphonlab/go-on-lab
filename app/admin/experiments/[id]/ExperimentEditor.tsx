"use client";

import React, { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdminShell } from "../../AdminShell";
import type { ExperimentDesign, DemographicsFields } from "@/app/lib/design";
import { LOCALES, LOCALE_LABEL, type Locale, type LocalizedText } from "@/app/lib/i18n";

type Tab = "basic" | "stimulus" | "staircase" | "practice" | "session" | "demographics" | "consent" | "share";

const TABS: { id: Tab; label: string }[] = [
  { id: "basic", label: "基本情報" },
  { id: "stimulus", label: "刺激" },
  { id: "staircase", label: "階段法" },
  { id: "practice", label: "練習" },
  { id: "session", label: "セッション" },
  { id: "demographics", label: "デモグラ" },
  { id: "consent", label: "同意・IRB" },
  { id: "share", label: "共有 & 結果" },
];

export function ExperimentEditor({
  initialDesign,
}: {
  initialDesign: ExperimentDesign;
}) {
  const [design, setDesign] = useState<ExperimentDesign>(initialDesign);
  const [savedDesign, setSavedDesign] = useState<ExperimentDesign>(initialDesign);
  const [tab, setTab] = useState<Tab>("basic");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const router = useRouter();

  const dirty = useMemo(
    () => JSON.stringify(design) !== JSON.stringify(savedDesign),
    [design, savedDesign],
  );

  const patch = useCallback(<K extends keyof ExperimentDesign>(key: K, value: ExperimentDesign[K]) => {
    setDesign((d) => ({ ...d, [key]: value }));
  }, []);

  async function save() {
    setSaving(true);
    setSaveError(null);
    try {
      const resp = await fetch(`/api/admin/experiments/${design.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(design),
      });
      const j = await resp.json().catch(() => ({}));
      if (resp.ok && j.ok && j.design) {
        setSavedDesign(j.design);
        setDesign(j.design);
        setSavedAt(new Date().toLocaleTimeString());
      } else {
        setSaveError(j.error || `HTTP ${resp.status}`);
      }
    } catch (e) {
      setSaveError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function destroy() {
    if (!confirm(`実験 "${design.id}" を完全に削除します。よろしいですか？`)) return;
    const resp = await fetch(`/api/admin/experiments/${design.id}`, {
      method: "DELETE",
    });
    if (resp.ok) router.push("/admin");
  }

  // keyboard shortcut: cmd/ctrl+s
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (dirty && !saving) save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <AdminShell title={design.id} back={{ href: "/admin", label: "一覧に戻る" }}>
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {TABS.map((tt) => (
          <button
            key={tt.id}
            onClick={() => setTab(tt.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              tab === tt.id
                ? "bg-emerald-500 text-white"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            {tt.label}
          </button>
        ))}
      </div>

      <div className="space-y-6">
        {tab === "basic" && <BasicTab design={design} patch={patch} />}
        {tab === "stimulus" && <StimulusTab design={design} patch={patch} />}
        {tab === "staircase" && <StaircaseTab design={design} patch={patch} />}
        {tab === "practice" && <PracticeTab design={design} patch={patch} />}
        {tab === "session" && <SessionTab design={design} patch={patch} />}
        {tab === "demographics" && (
          <DemographicsTab design={design} patch={patch} />
        )}
        {tab === "consent" && <ConsentTab design={design} patch={patch} />}
        {tab === "share" && <ShareTab design={design} />}
      </div>

      <div className="sticky bottom-0 left-0 right-0 mt-8 bg-slate-950/95 backdrop-blur border-t border-slate-800 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center gap-3 justify-between">
          <div className="text-xs text-slate-500">
            {saving
              ? "保存中…"
              : dirty
                ? "未保存の変更があります"
                : savedAt
                  ? `保存済 ${savedAt}`
                  : "変更なし"}
            {saveError && (
              <span className="ml-3 text-rose-400">{saveError}</span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={destroy}
              className="px-3 py-2 text-xs text-rose-300 hover:bg-rose-900/30 rounded-lg"
            >
              削除
            </button>
            <button
              onClick={save}
              disabled={!dirty || saving}
              className="px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold transition text-sm"
            >
              保存 (⌘S)
            </button>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}

type Patcher = <K extends keyof ExperimentDesign>(key: K, value: ExperimentDesign[K]) => void;

function Section({
  title,
  children,
  description,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 sm:p-6">
      <h2 className="text-sm font-bold text-emerald-400 tracking-widest uppercase mb-1">
        {title}
      </h2>
      {description && (
        <p className="text-xs text-slate-500 mb-4 leading-relaxed">{description}</p>
      )}
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
        {label}
      </label>
      {children}
      {hint && <p className="text-[11px] text-slate-500 mt-1">{hint}</p>}
    </div>
  );
}

function NumberInput({
  value,
  onChange,
  step,
  min,
  max,
}: {
  value: number;
  onChange: (n: number) => void;
  step?: number;
  min?: number;
  max?: number;
}) {
  return (
    <input
      type="number"
      step={step}
      min={min}
      max={max}
      value={value}
      onChange={(e) => {
        const n = Number(e.target.value);
        if (Number.isFinite(n)) onChange(n);
      }}
      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500 font-mono text-sm"
    />
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  maxLength,
}: {
  value: string;
  onChange: (s: string) => void;
  placeholder?: string;
  maxLength?: number;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500 text-sm"
    />
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (b: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer text-sm text-slate-200">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 accent-emerald-500"
      />
      <span>{label}</span>
    </label>
  );
}

function LocalizedInput({
  value,
  onChange,
  multiline,
}: {
  value: LocalizedText;
  onChange: (v: LocalizedText) => void;
  multiline?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {LOCALES.map((l) => (
        <div key={l}>
          <div className="text-[10px] tracking-wider text-slate-500 uppercase font-bold mb-1">
            {LOCALE_LABEL[l]}
          </div>
          {multiline ? (
            <textarea
              value={value[l]}
              onChange={(e) => onChange({ ...value, [l]: e.target.value })}
              rows={6}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500 text-sm leading-relaxed"
            />
          ) : (
            <input
              value={value[l]}
              onChange={(e) => onChange({ ...value, [l]: e.target.value })}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500 text-sm"
            />
          )}
        </div>
      ))}
    </div>
  );
}

function BasicTab({ design, patch }: { design: ExperimentDesign; patch: Patcher }) {
  return (
    <>
      <Section title="名称・説明">
        <Field label="タイトル (各言語)">
          <LocalizedInput
            value={design.title}
            onChange={(v) => patch("title", v)}
          />
        </Field>
        <Field label="説明 (各言語)">
          <LocalizedInput
            value={design.description}
            onChange={(v) => patch("description", v)}
            multiline
          />
        </Field>
      </Section>

      <Section
        title="言語設定"
        description="参加者UIで表示される言語を制御します。"
      >
        <Field
          label="デフォルト言語"
          hint="ブラウザ言語が一致しない場合に使用"
        >
          <select
            value={design.defaultLocale}
            onChange={(e) => patch("defaultLocale", e.target.value as Locale)}
            className="w-48 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500 text-sm"
          >
            {LOCALES.map((l) => (
              <option key={l} value={l}>
                {LOCALE_LABEL[l]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="許可する言語">
          <div className="grid grid-cols-2 gap-2">
            {LOCALES.map((l) => (
              <Toggle
                key={l}
                checked={design.enabledLocales.includes(l)}
                onChange={(b) => {
                  const set = new Set(design.enabledLocales);
                  if (b) set.add(l);
                  else set.delete(l);
                  const next = LOCALES.filter((x) => set.has(x));
                  if (next.length === 0) return;
                  patch("enabledLocales", next);
                }}
                label={LOCALE_LABEL[l]}
              />
            ))}
          </div>
        </Field>
        <Field
          label="言語切替UIを無効化"
          hint="チェックすると、選んだ言語に固定され、被験者は変更できません。"
        >
          <select
            value={design.forceLocale ?? ""}
            onChange={(e) =>
              patch(
                "forceLocale",
                e.target.value ? (e.target.value as Locale) : null,
              )
            }
            className="w-48 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500 text-sm"
          >
            <option value="">切替可（推奨）</option>
            {design.enabledLocales.map((l) => (
              <option key={l} value={l}>
                {LOCALE_LABEL[l]} に固定
              </option>
            ))}
          </select>
        </Field>
      </Section>

      <Section title="公開状態">
        <Field
          label="ステータス"
          hint="active のときのみ /e/[id] で参加可能。closed にすると停止画面が表示されます。"
        >
          <div className="flex gap-2">
            {(["draft", "active", "closed"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => patch("status", s)}
                className={`px-3 py-2 rounded-lg text-xs font-bold transition ${
                  design.status === s
                    ? s === "active"
                      ? "bg-emerald-600 text-white"
                      : s === "closed"
                        ? "bg-rose-700 text-white"
                        : "bg-slate-600 text-white"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
              >
                {s === "draft" ? "下書き" : s === "active" ? "公開" : "終了"}
              </button>
            ))}
          </div>
        </Field>
      </Section>
    </>
  );
}

function StimulusTab({ design, patch }: { design: ExperimentDesign; patch: Patcher }) {
  return (
    <Section
      title="刺激パラメータ"
      description="正弦波 純音の周波数・継続時間・レベル。"
    >
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Field label="基準周波数 (Hz)">
          <NumberInput
            value={design.referenceFrequencyHz}
            onChange={(n) => patch("referenceFrequencyHz", n)}
            min={50}
            max={20000}
          />
        </Field>
        <Field label="音の長さ (s)">
          <NumberInput
            value={design.toneDurationSec}
            onChange={(n) => patch("toneDurationSec", n)}
            step={0.01}
            min={0.02}
            max={5}
          />
        </Field>
        <Field label="ランプ (s)">
          <NumberInput
            value={design.rampDurationSec}
            onChange={(n) => patch("rampDurationSec", n)}
            step={0.001}
            min={0.001}
            max={0.5}
          />
        </Field>
        <Field label="ISI (s)" hint="音と音の間">
          <NumberInput
            value={design.isiSec}
            onChange={(n) => patch("isiSec", n)}
            step={0.05}
            min={0}
            max={5}
          />
        </Field>
        <Field label="ITI (s)" hint="試行と試行の間">
          <NumberInput
            value={design.itiSec}
            onChange={(n) => patch("itiSec", n)}
            step={0.05}
            min={0}
            max={10}
          />
        </Field>
        <Field label="出力レベル (0–1)">
          <NumberInput
            value={design.outputLevel}
            onChange={(n) => patch("outputLevel", n)}
            step={0.01}
            min={0.01}
            max={1}
          />
        </Field>
        <Field label="刺激前 無音 (s)">
          <NumberInput
            value={design.stimulusInitialSilenceSec}
            onChange={(n) => patch("stimulusInitialSilenceSec", n)}
            step={0.05}
            min={0}
            max={5}
          />
        </Field>
        <Field label="刺激後 無音 (s)">
          <NumberInput
            value={design.stimulusFinalSilenceSec}
            onChange={(n) => patch("stimulusFinalSilenceSec", n)}
            step={0.05}
            min={0}
            max={5}
          />
        </Field>
        <Field label="反応タイムアウト (s)">
          <NumberInput
            value={design.responseTimeoutSec}
            onChange={(n) => patch("responseTimeoutSec", n)}
            step={0.5}
            min={0}
            max={60}
          />
        </Field>
      </div>
    </Section>
  );
}

function StaircaseTab({
  design,
  patch,
}: {
  design: ExperimentDesign;
  patch: Patcher;
}) {
  return (
    <Section
      title="適応的階段法"
      description="2-down/1-up 変形上下法。70.7% 正答率収束。"
    >
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Field label="初期 ΔHz">
          <NumberInput
            value={design.initialDeltaHz}
            onChange={(n) => patch("initialDeltaHz", n)}
            step={1}
            min={0.1}
            max={5000}
          />
        </Field>
        <Field label="最小 ΔHz">
          <NumberInput
            value={design.minDeltaHz}
            onChange={(n) => patch("minDeltaHz", n)}
            step={0.1}
            min={0.01}
            max={1000}
          />
        </Field>
        <Field label="最大 ΔHz">
          <NumberInput
            value={design.maxDeltaHz}
            onChange={(n) => patch("maxDeltaHz", n)}
            step={1}
            min={1}
            max={10000}
          />
        </Field>
        <Field label="大きいステップ倍率">
          <NumberInput
            value={design.largeStepFactor}
            onChange={(n) => patch("largeStepFactor", n)}
            step={0.01}
            min={1.01}
            max={10}
          />
        </Field>
        <Field label="小さいステップ倍率">
          <NumberInput
            value={design.smallStepFactor}
            onChange={(n) => patch("smallStepFactor", n)}
            step={0.01}
            min={1.001}
            max={10}
          />
        </Field>
        <Field label="ステップ縮小に必要な反転数">
          <NumberInput
            value={design.stepChangeAfterReversal}
            onChange={(n) => patch("stepChangeAfterReversal", n)}
            min={1}
            max={20}
          />
        </Field>
        <Field label="停止までの反転数">
          <NumberInput
            value={design.reversalsToStop}
            onChange={(n) => patch("reversalsToStop", n)}
            min={2}
            max={30}
          />
        </Field>
        <Field label="閾値推定に使う反転数">
          <NumberInput
            value={design.reversalsToAverage}
            onChange={(n) => patch("reversalsToAverage", n)}
            min={2}
            max={30}
          />
        </Field>
        <Field label="最大試行数 / 階段">
          <NumberInput
            value={design.maxTrialsPerStaircase}
            onChange={(n) => patch("maxTrialsPerStaircase", n)}
            min={5}
            max={500}
          />
        </Field>
        <Field label="階段の数 (交互ラン)">
          <NumberInput
            value={design.numStaircases}
            onChange={(n) => patch("numStaircases", n)}
            min={1}
            max={5}
          />
        </Field>
      </div>
    </Section>
  );
}

function PracticeTab({
  design,
  patch,
}: {
  design: ExperimentDesign;
  patch: Patcher;
}) {
  return (
    <>
      <Section title="練習試行">
        <Toggle
          checked={design.practiceEnabled}
          onChange={(b) => patch("practiceEnabled", b)}
          label="練習を実施する"
        />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-4">
          <Field label="練習試行数">
            <NumberInput
              value={design.numPracticeTrials}
              onChange={(n) => patch("numPracticeTrials", n)}
              min={0}
              max={100}
            />
          </Field>
          <Field label="練習 ΔHz (固定)">
            <NumberInput
              value={design.practiceDeltaHz}
              onChange={(n) => patch("practiceDeltaHz", n)}
              min={0.1}
              max={5000}
            />
          </Field>
          <Field label="合格しきい値 (正答数)">
            <NumberInput
              value={design.practicePassThreshold}
              onChange={(n) => patch("practicePassThreshold", n)}
              min={0}
              max={100}
            />
          </Field>
        </div>
      </Section>

      <Section title="音響チェック">
        <Toggle
          checked={design.headphoneCheckEnabled}
          onChange={(b) => patch("headphoneCheckEnabled", b)}
          label="左右イヤホン確認を行う"
        />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-4">
          <Field label="試行数">
            <NumberInput
              value={design.numHeadphoneCheckTrials}
              onChange={(n) => patch("numHeadphoneCheckTrials", n)}
              min={0}
              max={30}
            />
          </Field>
          <Field label="合格しきい値">
            <NumberInput
              value={design.headphoneCheckPassThreshold}
              onChange={(n) => patch("headphoneCheckPassThreshold", n)}
              min={0}
              max={30}
            />
          </Field>
          <Field label="検査音 (Hz)">
            <NumberInput
              value={design.headphoneCheckFreqHz}
              onChange={(n) => patch("headphoneCheckFreqHz", n)}
              min={50}
              max={20000}
            />
          </Field>
        </div>
      </Section>
    </>
  );
}

function SessionTab({
  design,
  patch,
}: {
  design: ExperimentDesign;
  patch: Patcher;
}) {
  return (
    <Section title="セッション制御">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Field
          label="休憩を挿入する試行数"
          hint="0 で休憩なし"
        >
          <NumberInput
            value={design.breakAfterEvery}
            onChange={(n) => patch("breakAfterEvery", n)}
            min={0}
            max={500}
          />
        </Field>
        <Field
          label="休憩の最低秒数"
          hint="この秒数経過まで [続ける] は無効"
        >
          <NumberInput
            value={design.breakMinDurationSec}
            onChange={(n) => patch("breakMinDurationSec", n)}
            min={0}
            max={300}
          />
        </Field>
        <Field label="練習中の再生回数上限">
          <NumberInput
            value={design.maxReplaysPractice}
            onChange={(n) => patch("maxReplaysPractice", n)}
            min={0}
            max={20}
          />
        </Field>
        <Field
          label="本試行中の再生回数上限"
          hint="階段法の妥当性のため 0 推奨"
        >
          <NumberInput
            value={design.maxReplaysMain}
            onChange={(n) => patch("maxReplaysMain", n)}
            min={0}
            max={20}
          />
        </Field>
        <Field label="フィードバック表示秒">
          <NumberInput
            value={design.feedbackDurationSec}
            onChange={(n) => patch("feedbackDurationSec", n)}
            step={0.1}
            min={0}
            max={5}
          />
        </Field>
        <Field
          label="取り消し可能秒数"
          hint="0 で取り消し不可"
        >
          <NumberInput
            value={design.undoWindowSec}
            onChange={(n) => patch("undoWindowSec", n)}
            step={0.5}
            min={0}
            max={60}
          />
        </Field>
      </div>
      <Toggle
        checked={design.allowUndo}
        onChange={(b) => patch("allowUndo", b)}
        label="押し間違いの取り消し (Oops) ボタンを許可"
      />
    </Section>
  );
}

const DEMO_FIELD_LABELS: Record<keyof DemographicsFields, string> = {
  age: "年齢",
  gender: "性別",
  handedness: "利き手",
  nativeLanguage: "母語",
  otherLanguages: "他の言語",
  musicalTrainingYears: "音楽訓練年数",
  hearingImpairment: "聴覚状態",
  hearingAids: "補聴器使用",
  headphoneType: "ヘッドホン種別",
  environmentQuiet: "環境の静かさ",
};

function DemographicsTab({
  design,
  patch,
}: {
  design: ExperimentDesign;
  patch: Patcher;
}) {
  return (
    <Section title="人口統計情報">
      <Toggle
        checked={design.collectDemographics}
        onChange={(b) => patch("collectDemographics", b)}
        label="人口統計情報を収集する"
      />
      {design.collectDemographics && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
            {(Object.keys(DEMO_FIELD_LABELS) as (keyof DemographicsFields)[]).map(
              (k) => (
                <Toggle
                  key={k}
                  checked={design.demographicsFields[k]}
                  onChange={(b) =>
                    patch("demographicsFields", {
                      ...design.demographicsFields,
                      [k]: b,
                    })
                  }
                  label={DEMO_FIELD_LABELS[k]}
                />
              ),
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-4">
            <Field label="最小年齢">
              <NumberInput
                value={design.minAge}
                onChange={(n) => patch("minAge", n)}
                min={0}
                max={120}
              />
            </Field>
            <Field label="最大年齢">
              <NumberInput
                value={design.maxAge}
                onChange={(n) => patch("maxAge", n)}
                min={1}
                max={130}
              />
            </Field>
          </div>
        </>
      )}
    </Section>
  );
}

function ConsentTab({
  design,
  patch,
}: {
  design: ExperimentDesign;
  patch: Patcher;
}) {
  const overrideOn = design.consentTextOverride !== null;
  return (
    <>
      <Section title="IRB情報">
        <Field label="同意書バージョン">
          <TextInput
            value={design.consentVersion}
            onChange={(s) => patch("consentVersion", s)}
            maxLength={80}
          />
        </Field>
        <Field label="実施機関">
          <TextInput
            value={design.institution}
            onChange={(s) => patch("institution", s)}
            maxLength={200}
            placeholder="例: ○○大学 ○○学部"
          />
        </Field>
        <Field label="倫理審査番号">
          <TextInput
            value={design.irbReference}
            onChange={(s) => patch("irbReference", s)}
            maxLength={100}
            placeholder="例: IRB-2026-XXX"
          />
        </Field>
        <Field label="問い合わせ先 (email)">
          <TextInput
            value={design.contactEmail}
            onChange={(s) => patch("contactEmail", s)}
            maxLength={200}
            placeholder="example@univ.ac.jp"
          />
        </Field>
      </Section>

      <Section
        title="同意書本文の上書き"
        description="標準テンプレートの代わりに、所属機関固有の同意文を表示できます。"
      >
        <Toggle
          checked={overrideOn}
          onChange={(b) =>
            patch(
              "consentTextOverride",
              b
                ? { ja: "", en: "", ko: "", zh: "" }
                : null,
            )
          }
          label="独自の同意文を使用する"
        />
        {overrideOn && design.consentTextOverride && (
          <Field
            label="同意文 (各言語, 段落は空行で区切る)"
          >
            <LocalizedInput
              value={design.consentTextOverride}
              onChange={(v) => patch("consentTextOverride", v)}
              multiline
            />
          </Field>
        )}
      </Section>
    </>
  );
}

function useOrigin(): string {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener("popstate", cb);
      return () => window.removeEventListener("popstate", cb);
    },
    () => window.location.origin,
    () => "",
  );
}

function ShareTab({ design }: { design: ExperimentDesign }) {
  const origin = useOrigin();
  const link = origin ? `${origin}/e/${design.id}` : `/e/${design.id}`;

  return (
    <>
      <Section title="共有用リンク">
        {design.status !== "active" && (
          <div className="text-xs text-amber-300 bg-amber-900/20 border border-amber-700/40 rounded-lg p-3">
            ⚠ この実験のステータスは「{design.status === "draft" ? "下書き" : "終了"}」です。
            「公開」に変更しないと被験者は参加できません。
          </div>
        )}
        <Field label="参加者用URL">
          <div className="flex gap-2">
            <input
              readOnly
              value={link}
              onClick={(e) => (e.target as HTMLInputElement).select()}
              className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-emerald-300 font-mono text-sm"
            />
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(link)}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs text-slate-200"
            >
              コピー
            </button>
          </div>
        </Field>
        <Field
          label="QRコード"
          hint="スマホでアクセスする場合のリンク。LINE/メール/掲示物に貼り付け可能。"
        >
          {origin && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(link)}`}
              alt="QR code"
              className="w-40 h-40 bg-white p-2 rounded"
            />
          )}
        </Field>
      </Section>

      <Section title="結果データ">
        <Link
          href={`/admin/experiments/${design.id}/results`}
          className="inline-flex items-center px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-bold rounded-lg transition"
        >
          結果ファイル一覧を見る →
        </Link>
      </Section>
    </>
  );
}
