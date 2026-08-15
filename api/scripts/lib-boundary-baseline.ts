import type { ContextBoundaryViolation } from "./check-context-boundaries"

/**
 * 中立libへのコロケーション前から存在する所有者依存。
 * 完全一致だけを一時許容し、新規追加と解消済み項目の残留を品質ゲートで拒否する。
 */
export const LIB_BOUNDARY_BASELINE: ReadonlyArray<ContextBoundaryViolation> = []
