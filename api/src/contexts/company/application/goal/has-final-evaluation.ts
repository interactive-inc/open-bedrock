import type { GoalEvaluation } from "@/contexts/company/domain/goal/goal-evaluation.entity"

/**
 * 確定評価（kind=final）が含まれるかを判定する。
 * final が付いた目標は確定済みとして編集・削除を禁止する。
 */
export function hasFinalEvaluation(evaluations: ReadonlyArray<GoalEvaluation>): boolean {
  return evaluations.some((evaluation) => evaluation.kind === "final")
}
