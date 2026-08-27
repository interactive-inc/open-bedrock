import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
type SeedRingiRequest = {
  id: number
  applicantId: EmployeeId
  approverId: EmployeeId
  title: string
  amount: number
  reason: string
  status: "pending" | "approved" | "rejected"
  decidedAt: string | null
  decisionComment: string | null
  createdAt: string
}

/** applicantId / approverId は seedEmployees に存在する社員に対応させる。 */
export const seedRingiRequests: ReadonlyArray<SeedRingiRequest> = [
  {
    id: 1,
    applicantId: toWorkforceEmployeeId(5),
    approverId: toWorkforceEmployeeId(4),
    title: "新しいCIベンダーとの契約",
    amount: 240000,
    reason: "チームのビルド高速化のため",
    status: "pending",
    decidedAt: null,
    decisionComment: null,
    createdAt: "2026-05-11T01:00:00Z",
  },
  {
    id: 2,
    applicantId: toWorkforceEmployeeId(5),
    approverId: toWorkforceEmployeeId(4),
    title: "カンファレンス協賛",
    amount: 500000,
    reason: "ブランド露出のため",
    status: "approved",
    decidedAt: "2026-05-13T02:00:00Z",
    decisionComment: "予算内のため承認",
    createdAt: "2026-05-12T02:00:00Z",
  },
  {
    id: 3,
    applicantId: toWorkforceEmployeeId(10),
    approverId: toWorkforceEmployeeId(9),
    title: "CRMの追加ライセンス",
    amount: 120000,
    reason: "営業チームの増員のため",
    status: "pending",
    decidedAt: null,
    decisionComment: null,
    createdAt: "2026-05-14T03:00:00Z",
  },
]
