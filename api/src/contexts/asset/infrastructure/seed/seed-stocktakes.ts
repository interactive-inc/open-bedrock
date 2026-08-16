type SeedStocktake = {
  id: string
  name: string
  targetDate: string
  status: string
  createdAt: string
  closedAt: string | null
}

export const seedStocktakes: ReadonlyArray<SeedStocktake> = [
  {
    id: "a1b2c3d4-e5f6-4a1b-8c2d-000000000001",
    name: "2026年上期 棚卸し",
    targetDate: "2026-04-01",
    status: "open",
    createdAt: "2026-04-01T09:00:00Z",
    closedAt: null,
  },
  {
    id: "a1b2c3d4-e5f6-4a1b-8c2d-000000000002",
    name: "2025年下期 棚卸し",
    targetDate: "2025-10-01",
    status: "closed",
    createdAt: "2025-10-01T09:00:00Z",
    closedAt: "2025-10-05T18:00:00Z",
  },
]
