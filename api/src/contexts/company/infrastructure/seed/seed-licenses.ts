type SeedLicense = {
  id: number
  name: string
  vendor: string | null
  category: string | null
  seats: number | null
  renewalDeadline: string | null
  ownerEmployeeId: number | null
  note: string | null
  status: "active" | "cancelled"
  createdAt: string
}

export const seedLicenses: ReadonlyArray<SeedLicense> = [
  {
    id: 1,
    name: "プロジェクト管理ツール",
    vendor: "サンプルSaaS株式会社",
    category: "saas",
    seats: 50,
    renewalDeadline: "2026-03-31",
    ownerEmployeeId: 1,
    note: null,
    status: "active",
    createdAt: "2026-01-05T00:00:00Z",
  },
  {
    id: 2,
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
