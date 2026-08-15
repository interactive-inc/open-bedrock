import type { ContextBoundaryViolation } from "./check-context-boundaries"

/**
 * 中立libへのコロケーション前から存在する所有者依存。
 * 完全一致だけを一時許容し、新規追加と解消済み項目の残留を品質ゲートで拒否する。
 */
export const LIB_BOUNDARY_BASELINE: ReadonlyArray<ContextBoundaryViolation> = [
  {
    file: "src/lib/auth/verify-identity-token.test.ts",
    reason:
      "lib から所有者のある実装へ依存しています: @/contexts/company/interface/test-helpers/create-identity-test-key",
  },
  {
    file: "src/lib/auth/verify-identity-token.test.ts",
    reason:
      "lib から所有者のある実装へ依存しています: @/contexts/company/interface/test-helpers/create-identity-token",
  },
  {
    file: "src/lib/goal/can-read-goal-of.test.ts",
    reason: "lib から所有者のある実装へ依存しています: @/contexts/company/domain/iam/session",
  },
  {
    file: "src/lib/goal/can-read-goal-of.test.ts",
    reason:
      "lib から所有者のある実装へ依存しています: @/contexts/company/domain/organization/employee-relation",
  },
  {
    file: "src/lib/goal/can-read-goal-of.test.ts",
    reason:
      "lib から所有者のある実装へ依存しています: @/contexts/company/interface/test-helpers/make-test-session",
  },
  {
    file: "src/lib/goal/can-read-goal-of.ts",
    reason: "lib から所有者のある実装へ依存しています: @/contexts/company/domain/iam/session",
  },
  {
    file: "src/lib/goal/can-read-goal-of.ts",
    reason:
      "lib から所有者のある実装へ依存しています: @/contexts/company/domain/organization/employee-relation",
  },
]
