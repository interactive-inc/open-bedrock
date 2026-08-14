import type { ContextBoundaryViolation } from "./check-context-boundaries"

/**
 * 中立libへのコロケーション前から存在する所有者依存。
 * 完全一致だけを一時許容し、新規追加と解消済み項目の残留を品質ゲートで拒否する。
 */
export const LIB_BOUNDARY_BASELINE: ReadonlyArray<ContextBoundaryViolation> = [
  {
    file: "src/lib/application/applicable-workflow-steps.ts",
    reason:
      "lib から所有者のある実装へ依存しています: @/contexts/company/domain/application/application-workflow",
  },
  {
    file: "src/lib/application/can-decide-legacy-application.ts",
    reason: "lib から所有者のある実装へ依存しています: @/contexts/company/domain/iam/session",
  },
  {
    file: "src/lib/application/can-decide-legacy-application.ts",
    reason:
      "lib から所有者のある実装へ依存しています: @/contexts/company/application/organization/resolve-organization-authority",
  },
  {
    file: "src/lib/application/ensure-workflow-step-escalation.ts",
    reason:
      "lib から所有者のある実装へ依存しています: @/contexts/company/infrastructure/application/application-workflow-repository",
  },
  {
    file: "src/lib/application/filter-live-workflow-accounts.test.ts",
    reason:
      "lib から所有者のある実装へ依存しています: @/contexts/company/interface/test-helpers/create-test-context",
  },
  {
    file: "src/lib/application/filter-live-workflow-accounts.ts",
    reason:
      "lib から所有者のある実装へ依存しています: @/contexts/company/infrastructure/employee-lifecycle/employee-lifecycle-read-repository",
  },
  {
    file: "src/lib/application/filter-live-workflow-accounts.ts",
    reason:
      "lib から所有者のある実装へ依存しています: @/contexts/company/infrastructure/employee-lifecycle/employee-lifecycle-repository",
  },
  {
    file: "src/lib/application/load-or-resolve-workflow-step-snapshot.ts",
    reason:
      "lib から所有者のある実装へ依存しています: @/contexts/company/domain/application/application-workflow",
  },
  {
    file: "src/lib/application/load-or-resolve-workflow-step-snapshot.ts",
    reason:
      "lib から所有者のある実装へ依存しています: @/contexts/company/infrastructure/application/application-workflow-repository",
  },
  {
    file: "src/lib/application/persist-resolved-workflow-step-snapshot.ts",
    reason:
      "lib から所有者のある実装へ依存しています: @/contexts/company/infrastructure/application/application-workflow-repository",
  },
  {
    file: "src/lib/application/persist-resolved-workflow-step-snapshot.ts",
    reason:
      "lib から所有者のある実装へ依存しています: @/contexts/company/infrastructure/application/workflow-sql",
  },
  {
    file: "src/lib/application/resolve-represented-approver.ts",
    reason: "lib から所有者のある実装へ依存しています: @/schema",
  },
  {
    file: "src/lib/application/resolve-workflow-approver-matches.test.ts",
    reason:
      "lib から所有者のある実装へ依存しています: @/contexts/company/interface/test-helpers/create-test-context",
  },
  {
    file: "src/lib/application/resolve-workflow-approver-matches.ts",
    reason:
      "lib から所有者のある実装へ依存しています: @/contexts/company/domain/application/application-workflow",
  },
  {
    file: "src/lib/application/resolve-workflow-approver-matches.ts",
    reason:
      "lib から所有者のある実装へ依存しています: @/contexts/company/infrastructure/employee-lifecycle/employee-lifecycle-read-repository",
  },
  {
    file: "src/lib/application/resolve-workflow-approver-matches.ts",
    reason:
      "lib から所有者のある実装へ依存しています: @/contexts/company/infrastructure/employee-lifecycle/employee-lifecycle-repository",
  },
  {
    file: "src/lib/application/resolve-workflow-approver-matches.ts",
    reason: "lib から所有者のある実装へ依存しています: @/schema",
  },
  {
    file: "src/lib/application/resolve-workflow-step-snapshot.ts",
    reason:
      "lib から所有者のある実装へ依存しています: @/contexts/company/domain/application/application-workflow",
  },
  {
    file: "src/lib/application/resolve-workflow-step-snapshot.ts",
    reason: "lib から所有者のある実装へ依存しています: @/schema",
  },
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
