type SeedGrade = {
  id: number
  code: string
  name: string
  rank: number
  description: string | null
  createdAt: string
}

export const seedGrades: ReadonlyArray<SeedGrade> = [
  {
    id: 1,
    code: "G1",
    name: "Associate",
    rank: 1,
    description: "Entry level",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: 2,
    code: "G2",
    name: "Professional",
    rank: 2,
    description: "Mid level",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: 3,
    code: "G3",
    name: "Senior",
    rank: 3,
    description: null,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
]
