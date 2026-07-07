type SeedAnnouncement = {
  id: number
  title: string
  bodyMd: string
  publishedOn: string | null
  authorEmployeeId: number
  status: string
  createdAt: string
}

export const seedAnnouncements: ReadonlyArray<SeedAnnouncement> = [
  {
    id: 1,
    title: "Office Move Notice",
    bodyMd: "We are moving to a new office on the 10th floor.",
    publishedOn: "2026-02-01",
    authorEmployeeId: 1,
    status: "published",
    createdAt: "2026-02-01T09:00:00Z",
  },
  {
    id: 2,
    title: "Summer Holiday Schedule",
    bodyMd: "The summer holidays will run from August 12 to 16.",
    publishedOn: "2026-06-15",
    authorEmployeeId: 1,
    status: "published",
    createdAt: "2026-06-15T09:00:00Z",
  },
  {
    id: 3,
    title: "Draft: New Expense Policy",
    bodyMd: "Details of the upcoming expense policy revision.",
    publishedOn: null,
    authorEmployeeId: 1,
    status: "draft",
    createdAt: "2026-06-20T09:00:00Z",
  },
  {
    id: 4,
    title: "Archived: Old Parking Rules",
    bodyMd: "The old parking rules that no longer apply.",
    publishedOn: "2025-01-10",
    authorEmployeeId: 1,
    status: "archived",
    createdAt: "2025-01-10T09:00:00Z",
  },
]
