import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
type SeedAssetLending = {
  id: number
  assetCode: string
  employeeId: EmployeeId
  lentAt: string
  returnedAt: string | null
}

/** lent 状態の資産には returnedAt:null の open レコードを対応させる。 */
export const seedAssetLendings: ReadonlyArray<SeedAssetLending> = [
  {
    id: 1,
    assetCode: "A0001",
    employeeId: toWorkforceEmployeeId(5),
    lentAt: "2026-04-01T09:00:00Z",
    returnedAt: null,
  },
  {
    id: 2,
    assetCode: "A0002",
    employeeId: toWorkforceEmployeeId(9),
    lentAt: "2026-04-01T09:00:00Z",
    returnedAt: null,
  },
  {
    id: 3,
    assetCode: "A0003",
    employeeId: toWorkforceEmployeeId(5),
    lentAt: "2025-12-01T09:00:00Z",
    returnedAt: "2026-03-31T18:00:00Z",
  },
]
