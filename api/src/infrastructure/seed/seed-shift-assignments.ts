type SeedShiftAssignment = {
  id: number
  employeeId: number
  patternId: number | null
  date: string
  note: string | null
  publishedAt: string | null
}

/** publishedAt:null は下書き、文字列入りは公開済み。 */
export const seedShiftAssignments: ReadonlyArray<SeedShiftAssignment> = [
  {
    id: 1,
    employeeId: 5,
    patternId: 1,
    date: "2026-06-01",
    note: null,
    publishedAt: "2026-05-20T09:00:00Z",
  },
  { id: 2, employeeId: 5, patternId: 2, date: "2026-06-02", note: "Training", publishedAt: null },
  {
    id: 3,
    employeeId: 4,
    patternId: 1,
    date: "2026-06-01",
    note: null,
    publishedAt: "2026-05-20T09:00:00Z",
  },
]
