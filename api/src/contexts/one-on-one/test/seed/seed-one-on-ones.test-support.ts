import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
export type SeedOneOnOne = {
  id: string
  memberId: EmployeeId
  managerId: EmployeeId
  heldAt: string
  topics: string | null
  managerNote: string | null
  nextAction: string | null
}

export const seedOneOnOnes: ReadonlyArray<SeedOneOnOne> = [
  {
    id: "00000000-0000-0000-0000-000000000001",
    memberId: toWorkforceEmployeeId(5),
    managerId: toWorkforceEmployeeId(4),
    heldAt: "2026-05-01T05:00:00Z",
    topics: "目標の進捗とキャリアの方向性",
    managerNote: "リードを任せられる有望な人材",
    nextAction: "次回の設計レビューの担当を割り当てる",
  },
  {
    id: "00000000-0000-0000-0000-000000000002",
    memberId: toWorkforceEmployeeId(3),
    managerId: toWorkforceEmployeeId(4),
    heldAt: "2026-05-08T05:00:00Z",
    topics: "テストカバレッジの目標",
    managerNote: "順調に進行中、引き続き業務量を注視",
    nextAction: "毎週進捗を共有する",
  },
  {
    id: "00000000-0000-0000-0000-000000000003",
    memberId: toWorkforceEmployeeId(10),
    managerId: toWorkforceEmployeeId(9),
    heldAt: "2026-05-12T06:00:00Z",
    topics: "新規顧客獲得の戦略",
    managerNote: "ターゲット企業を絞り込むことで合意",
    nextAction: "優先アカウントリストを作成する",
  },
]
