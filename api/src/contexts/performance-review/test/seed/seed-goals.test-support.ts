import { testEmployeeId } from "@tests/api/support/test-identity-id"
import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"

type SeedGoal = {
  id: string
  employeeId: EmployeeId
  period: string
  title: string
  kpi: string | null
  weight: number
  status: string
}

export const seedGoals: ReadonlyArray<SeedGoal> = [
  {
    id: "01900030-0000-7000-8000-000000000001",
    employeeId: toWorkforceEmployeeId(testEmployeeId(5)),
    period: "2026-H1",
    title: "新ダッシュボード機能をリリースする",
    kpi: "重大バグゼロでリリース",
    weight: 40,
    status: "in_progress",
  },
  {
    id: "01900030-0000-7000-8000-000000000002",
    employeeId: toWorkforceEmployeeId(testEmployeeId(5)),
    period: "2026-H1",
    title: "コードレビューの折り返し時間を短縮する",
    kpi: "平均応答時間4時間以内",
    weight: 20,
    status: "in_progress",
  },
  {
    id: "01900030-0000-7000-8000-000000000003",
    employeeId: toWorkforceEmployeeId(testEmployeeId(9)),
    period: "2026-H1",
    title: "テストカバレッジを改善する",
    kpi: "カバレッジ80%以上",
    weight: 30,
    status: "in_progress",
  },
  {
    id: "01900030-0000-7000-8000-000000000004",
    employeeId: toWorkforceEmployeeId(testEmployeeId(9)),
    period: "2025-H2",
    title: "CI/CDパイプラインを構築する",
    kpi: "デプロイの完全自動化",
    weight: 50,
    status: "completed",
  },
  {
    id: "01900030-0000-7000-8000-000000000005",
    employeeId: toWorkforceEmployeeId(testEmployeeId(10)),
    period: "2026-H1",
    title: "新規顧客を10件獲得する",
    kpi: "契約成立10件",
    weight: 60,
    status: "in_progress",
  },
  {
    id: "01900030-0000-7000-8000-000000000006",
    employeeId: toWorkforceEmployeeId(testEmployeeId(10)),
    period: "2026-H1",
    title: "既存顧客の解約率を下げる",
    kpi: "解約率5%未満",
    weight: 20,
    status: "draft",
  },
  {
    id: "01900030-0000-7000-8000-000000000007",
    employeeId: toWorkforceEmployeeId(testEmployeeId(13)),
    period: "2026-H1",
    title: "オンボーディング資料を刷新する",
    kpi: "資料刷新完了",
    weight: 30,
    status: "in_progress",
  },
  {
    id: "01900030-0000-7000-8000-000000000008",
    employeeId: toWorkforceEmployeeId(testEmployeeId(3)),
    period: "2026-H1",
    title: "採用プロセスを改善する",
    kpi: "選考リードタイム30%短縮",
    weight: 40,
    status: "draft",
  },
]
