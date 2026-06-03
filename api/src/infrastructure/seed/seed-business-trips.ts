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
    destination: "Osaka Branch",
    startDate: "2026-06-10",
    endDate: "2026-06-12",
    purpose: "Quarterly partner meeting",
    estimatedCost: 45000,
    status: "requested",
    createdAt: "2026-06-01T00:00:00.000Z",
  },
  {
    id: "10000000-0000-0000-0000-000000000002",
    travelerId: 4,
    destination: "Sapporo Site",
    startDate: "2026-06-20",
    endDate: "2026-06-22",
    purpose: "On-site equipment inspection",
    estimatedCost: null,
    status: "requested",
    createdAt: "2026-06-01T00:00:00.000Z",
  },
  {
    id: "10000000-0000-0000-0000-000000000003",
    travelerId: 9,
    destination: "Fukuoka Office",
    startDate: "2026-07-01",
    endDate: "2026-07-03",
    purpose: "New hire onboarding support",
    estimatedCost: 38000,
    status: "requested",
    createdAt: "2026-06-01T00:00:00.000Z",
  },
]
