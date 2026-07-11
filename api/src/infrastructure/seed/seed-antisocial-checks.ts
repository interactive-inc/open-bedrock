type SeedAntisocialCheck = {
  id: string
  requesterId: number
  partnerName: string
  partnerAddress: string | null
  representativeName: string | null
  result: string | null
  status: string
  createdAt: string
}

export const seedAntisocialChecks: ReadonlyArray<SeedAntisocialCheck> = [
  {
    id: "20000000-0000-0000-0000-000000000001",
    requesterId: 2,
    partnerName: "Example Trading Co.",
    partnerAddress: "1-2-3 Sample, Example City",
    representativeName: "Pat Example",
    result: null,
    status: "requested",
    createdAt: "2026-06-01T00:00:00.000Z",
  },
  {
    id: "20000000-0000-0000-0000-000000000002",
    requesterId: 4,
    partnerName: "Sample Logistics Inc.",
    partnerAddress: null,
    representativeName: null,
    result: null,
    status: "requested",
    createdAt: "2026-06-01T00:00:00.000Z",
  },
  {
    id: "20000000-0000-0000-0000-000000000003",
    requesterId: 9,
    partnerName: "Demo Partners LLC",
    partnerAddress: "4-5-6 Placeholder, Example City",
    representativeName: "Alex Sample",
    result: null,
    status: "requested",
    createdAt: "2026-06-01T00:00:00.000Z",
  },
]
