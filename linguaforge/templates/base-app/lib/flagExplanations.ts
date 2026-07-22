// Mirrors linguaforge/data_tables/l1_interference_en_ja.json — kept as a
// small standalone copy so the generated app has no dependency outside its
// own copied tree. Corrective-feedback text (Lyster & Ranta): always explain
// *why* the mistake is easy to make (L1 interference), not just the answer.
export const FLAG_EXPLANATIONS: Record<string, string> = {
  l_r_contrast: "日本語には /l/-/r/ の区別がなく、両方とも「ラ行」に近い音として知覚されやすい。",
  b_v_contrast: "日本語の /b/ に近く聞こえ、/v/ を /b/ で代用しやすい。",
  s_th_contrast: "歯間音 /θ/ /ð/ は日本語に存在せず、/s/ /z/ や /d/ で代用されやすい。",
  i_ii_contrast: "日本語の母音体系では /ɪ/ と /iː/ の長短・音質の区別が弱い。",
  f_h_contrast: "語頭の /f/ が日本語の /h/（フ）に近く知覚され代用されやすい。",
  consonant_cluster: "日本語は開音節中心のため、子音連続に母音が挿入されやすい。",
  weak_form: "機能語は文中で弱形になり、聞き取りにくい（連結・弱化）。",
  contraction: "短縮形は音が変化・脱落するため、書き言葉のスペルと聞こえ方が異なる。",
  reduction: "口語的な縮約形。音節が融合して1語のように発音される。",
  palatalization: "/dʒ/ のような同化（you の /j/ と直前の子音が融合）が起きている。",
};

export function explainFlags(flags: string[]): string[] {
  return flags.map((f) => FLAG_EXPLANATIONS[f]).filter((v): v is string => Boolean(v));
}
