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
    name: "一般職",
    rank: 1,
    description: "初級",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: 2,
    code: "G2",
    name: "中堅職",
    rank: 2,
    description: "中級",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: 3,
    code: "G3",
    name: "上級職",
    rank: 3,
    description: null,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
]
