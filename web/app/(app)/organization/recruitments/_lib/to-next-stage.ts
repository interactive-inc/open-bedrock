/** 選考ステージ。表示名と遷移の純関数群は api の遷移規則と対応させる */
export type CandidateStage = "applied" | "screening" | "interview" | "offer" | "hired" | "rejected"

const FORWARD_STAGE = new Map<string, CandidateStage>([
  ["applied", "screening"],
  ["screening", "interview"],
  ["interview", "offer"],
  ["offer", "hired"],
])

/** 正順の1つ先ステージ。終端(hired/rejected)や未知値は null。 */
export function toNextStage(stage: string): CandidateStage | null {
  return FORWARD_STAGE.get(stage) ?? null
}
