type SeedBusinessTrip = {
  id: string
  travelerId: number
  destination: string
  startDate: string
  endDate: string
  purpose: string
  estimatedCost: number | null
  status: string
  createdAt: string
}

export const seedBusinessTrips: ReadonlyArray<SeedBusinessTrip> = [
  {
    id: "10000000-0000-0000-0000-000000000001",
    travelerId: 2,
    destination: "大阪支社",
    startDate: "2026-06-10",
    endDate: "2026-06-12",
    purpose: "四半期パートナー会議",
    estimatedCost: 45000,
    status: "requested",
    createdAt: "2026-06-01T00:00:00.000Z",
  },
  {
    id: "10000000-0000-0000-0000-000000000002",
    travelerId: 4,
    destination: "札幌拠点",
    startDate: "2026-06-20",
    endDate: "2026-06-22",
    purpose: "現地設備点検",
    estimatedCost: null,
    status: "requested",
    createdAt: "2026-06-01T00:00:00.000Z",
  },
  {
    id: "10000000-0000-0000-0000-000000000003",
    travelerId: 9,
    destination: "福岡オフィス",
    startDate: "2026-07-01",
    endDate: "2026-07-03",
    purpose: "新入社員オンボーディング支援",
    estimatedCost: 38000,
    status: "requested",
    createdAt: "2026-06-01T00:00:00.000Z",
  },
]
