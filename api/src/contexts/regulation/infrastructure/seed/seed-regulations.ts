type SeedRegulation = {
  id: number
  code: string
  title: string
  category: string | null
  status: string
  createdAt: string
}

type SeedRegulationVersion = {
  id: number
  regulationId: number
  version: number
  bodyMd: string
  effectiveOn: string
  note: string | null
  createdAt: string
}

export const seedRegulations: ReadonlyArray<SeedRegulation> = [
  {
    id: 1,
    code: "REG-001",
    title: "就業規則",
    category: "labor",
    status: "active",
    createdAt: "2025-04-01T09:00:00Z",
  },
  {
    id: 2,
    code: "REG-002",
    title: "旅費規程",
    category: "expense",
    status: "active",
    createdAt: "2025-04-01T09:00:00Z",
  },
  {
    id: 3,
    code: "REG-003",
    title: "旧服装規定",
    category: null,
    status: "archived",
    createdAt: "2024-01-01T09:00:00Z",
  },
]

export const seedRegulationVersions: ReadonlyArray<SeedRegulationVersion> = [
  {
    id: 1,
    regulationId: 1,
    version: 1,
    bodyMd: "就業規則の初版。",
    effectiveOn: "2025-04-01",
    note: null,
    createdAt: "2025-04-01T09:00:00Z",
  },
  {
    id: 2,
    regulationId: 1,
    version: 2,
    bodyMd: "リモートワークに対応した改訂版就業規則。",
    effectiveOn: "2026-04-01",
    note: "リモートワーク対応の更新",
    createdAt: "2026-03-15T09:00:00Z",
  },
  {
    id: 3,
    regulationId: 2,
    version: 1,
    bodyMd: "旅費規程。",
    effectiveOn: "2025-04-01",
    note: null,
    createdAt: "2025-04-01T09:00:00Z",
  },
]
