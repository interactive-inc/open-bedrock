import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"

type SeedLicense = {
  id: string
  name: string
  vendor: string | null
  category: string | null
  seats: number | null
  renewalDeadline: string | null
  ownerEmployeeId: EmployeeId | null
  note: string | null
  status: "active" | "cancelled"
  createdAt: string
}

export const seedLicenses: ReadonlyArray<SeedLicense> = [
  {
    id: "0190004b-0000-7000-8000-000000000001",
    name: "プロジェクト管理ツール",
    vendor: "サンプルSaaS株式会社",
    category: "saas",
    seats: 50,
    renewalDeadline: "2026-03-31",
    ownerEmployeeId: toWorkforceEmployeeId(1),
    note: null,
    status: "active",
    createdAt: "2026-01-05T00:00:00Z",
  },
  {
    id: "0190004b-0000-7000-8000-000000000002",
    name: "デザイン制作ソフト",
    vendor: null,
    category: "software",
    seats: 10,
    renewalDeadline: "2026-06-30",
    ownerEmployeeId: null,
    note: null,
    status: "active",
    createdAt: "2026-01-06T00:00:00Z",
  },
]
