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
    title: "Work Rules",
    category: "labor",
    status: "active",
    createdAt: "2025-04-01T09:00:00Z",
  },
  {
    id: 2,
    code: "REG-002",
    title: "Travel Expense Rules",
    category: "expense",
    status: "active",
    createdAt: "2025-04-01T09:00:00Z",
  },
  {
    id: 3,
    code: "REG-003",
    title: "Legacy Dress Code",
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
    bodyMd: "Initial work rules.",
    effectiveOn: "2025-04-01",
    note: null,
    createdAt: "2025-04-01T09:00:00Z",
  },
  {
    id: 2,
    regulationId: 1,
    version: 2,
    bodyMd: "Revised work rules with remote work.",
    effectiveOn: "2026-04-01",
    note: "remote work update",
    createdAt: "2026-03-15T09:00:00Z",
  },
  {
    id: 3,
    regulationId: 2,
    version: 1,
    bodyMd: "Travel expense rules.",
    effectiveOn: "2025-04-01",
    note: null,
    createdAt: "2025-04-01T09:00:00Z",
  },
]
