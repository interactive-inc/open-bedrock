type SeedReviewCycle = {
  id: number
  title: string
  period: string
  status: "draft" | "open" | "closed"
  dueDate: string | null
}

export const seedReviewCycles: ReadonlyArray<SeedReviewCycle> = [
  {
    id: 1,
    title: "2026 H1 Multi-rater Review",
    period: "2026-H1",
    status: "open",
    dueDate: "2026-06-30",
  },
  {
    id: 2,
    title: "2025 H2 Multi-rater Review",
    period: "2025-H2",
    status: "closed",
    dueDate: "2025-12-31",
  },
  { id: 3, title: "2026 H2 Multi-rater Review", period: "2026-H2", status: "draft", dueDate: null },
]
