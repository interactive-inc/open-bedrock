type SeedRegulation = {
  id: string
  code: string
  title: string
  category: string | null
  status: string
  createdAt: string
}

type SeedRegulationVersion = {
  id: string
  regulationId: string
  version: number
  bodyMd: string
  effectiveOn: string
  note: string | null
  createdAt: string
}

export const seedRegulations: ReadonlyArray<SeedRegulation> = [
  {
    id: "0190001f-0000-7000-8000-000000000001",
    code: "REG-001",
    title: "就業規則",
    category: "labor",
    status: "active",
    createdAt: "2025-04-01T09:00:00Z",
  },
  {
    id: "0190001f-0000-7000-8000-000000000002",
    code: "REG-002",
    title: "旅費規程",
    category: "expense",
    status: "active",
    createdAt: "2025-04-01T09:00:00Z",
  },
  {
    id: "0190001f-0000-7000-8000-000000000003",
    code: "REG-003",
    title: "旧服装規定",
    category: null,
    status: "archived",
    createdAt: "2024-01-01T09:00:00Z",
  },
]

export const seedRegulationVersions: ReadonlyArray<SeedRegulationVersion> = [
  {
    id: "01900020-0000-7000-8000-000000000001",
    regulationId: "0190001f-0000-7000-8000-000000000001",
    version: 1,
    bodyMd: "就業規則の初版。",
    effectiveOn: "2025-04-01",
    note: null,
    createdAt: "2025-04-01T09:00:00Z",
  },
  {
    id: "01900020-0000-7000-8000-000000000002",
    regulationId: "0190001f-0000-7000-8000-000000000001",
    version: 2,
    bodyMd: "リモートワークに対応した改訂版就業規則。",
    effectiveOn: "2026-04-01",
    note: "リモートワーク対応の更新",
    createdAt: "2026-03-15T09:00:00Z",
  },
  {
    id: "01900020-0000-7000-8000-000000000003",
    regulationId: "0190001f-0000-7000-8000-000000000002",
    version: 1,
    bodyMd: "旅費規程。",
    effectiveOn: "2025-04-01",
    note: null,
    createdAt: "2025-04-01T09:00:00Z",
  },
]
