type SeedPosition = {
  id: number
  code: string
  name: string
  rank: number
  description: string | null
  createdAt: string
}

export const seedPositions: ReadonlyArray<SeedPosition> = [
  {
    id: 1,
    code: "CTO",
    name: "CTO",
    rank: 1,
    description: "Chief Technology Officer",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: 2,
    code: "HR_MGR",
    name: "HR Manager",
    rank: 2,
    description: null,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: 3,
    code: "HR_STAFF",
    name: "HR Staff",
    rank: 3,
    description: null,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: 4,
    code: "ENG_MGR",
    name: "Engineering Manager",
    rank: 4,
    description: null,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: 5,
    code: "SR_ENG",
    name: "Senior Engineer",
    rank: 5,
    description: null,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: 6,
    code: "ENG",
    name: "Engineer",
    rank: 6,
    description: null,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: 7,
    code: "SALES_MGR",
    name: "Sales Manager",
    rank: 7,
    description: null,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: 8,
    code: "SALES_STAFF",
    name: "Sales Staff",
    rank: 8,
    description: null,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: 9,
    code: "CS_MGR",
    name: "CS Manager",
    rank: 9,
    description: null,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: 10,
    code: "CS_STAFF",
    name: "CS Staff",
    rank: 10,
    description: null,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: 11,
    code: "ADMIN_MGR",
    name: "Admin Manager",
    rank: 11,
    description: null,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: 12,
    code: "ADMIN_STAFF",
    name: "Admin Staff",
    rank: 12,
    description: null,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
]
