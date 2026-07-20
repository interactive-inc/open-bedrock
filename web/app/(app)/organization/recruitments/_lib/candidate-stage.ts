/** 選考ステージ。表示名と遷移の純関数群は api の遷移規則と対応させる */
export type CandidateStage = "applied" | "screening" | "interview" | "offer" | "hired" | "rejected"

const STAGE_LABELS = new Map<string, string>([
  ["applied", "応募"],
  ["screening", "書類選考"],
  ["interview", "面接"],
  ["offer", "内定"],
  ["hired", "採用"],
  ["rejected", "不採用"],
])

const FORWARD_STAGE = new Map<string, CandidateStage>([
  ["applied", "screening"],
  ["screening", "interview"],
  ["interview", "offer"],
  ["offer", "hired"],
])

/** ステージの日本語表示名を返す。未知値はそのまま返す。 */
export function toCandidateStageLabel(stage: string): string {
  return STAGE_LABELS.get(stage) ?? stage
}

/** 正順の1つ先ステージ。終端(hired/rejected)や未知値は null。 */
export function toNextStage(stage: string): CandidateStage | null {
  return FORWARD_STAGE.get(stage) ?? null
}

/** 不採用へ遷移できるか（hired/rejected 以外なら可）。 */
export function canReject(stage: string): boolean {
  return stage !== "hired" && stage !== "rejected"
}
