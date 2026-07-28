const STAGE_LABELS = new Map<string, string>([
  ["applied", "応募"],
  ["screening", "書類選考"],
  ["interview", "面接"],
  ["offer", "内定"],
  ["hired", "採用"],
  ["rejected", "不採用"],
])

/** ステージの日本語表示名を返す。未知値はそのまま返す。 */
export function toCandidateStageLabel(stage: string): string {
  return STAGE_LABELS.get(stage) ?? stage
}
