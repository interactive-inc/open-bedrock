import { toWorkforceOrganizationUnitId } from "@/contexts/company/domain/definitions/to-workforce-organization-unit-id.definition"
import type { OrganizationUnitId } from "@/contexts/company/domain/definitions/workforce-id.definition"

type SeedBudget = {
  id: number
  organizationUnitId: OrganizationUnitId
  fiscalPeriod: string
  periodStart: string
  periodEnd: string
  amount: number
  name: string
  note: string | null
  createdAt: string
}

/**
 * organizationUnitId は標準 Company 組織に存在する単位へ対応させる。
 * 開発部は seed-expenses の承認済み経費(id:2, 3300)が消化額に反映される。
 */
export const seedBudgets: ReadonlyArray<SeedBudget> = [
  {
    id: 1,
    organizationUnitId: toWorkforceOrganizationUnitId("D003"),
    fiscalPeriod: "2026",
    periodStart: "2026-04-01",
    periodEnd: "2027-03-31",
    amount: 1_000_000,
    name: "開発部 2026年度",
    note: "年間運用予算",
    createdAt: "2026-04-01T00:00:00Z",
  },
  {
    id: 2,
    organizationUnitId: toWorkforceOrganizationUnitId("D004"),
    fiscalPeriod: "2026",
    periodStart: "2026-04-01",
    periodEnd: "2027-03-31",
    amount: 500_000,
    name: "営業部 2026年度",
    note: null,
    createdAt: "2026-04-01T00:00:00Z",
  },
]
