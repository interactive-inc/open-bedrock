type SeedLicense = {
  id: number
  name: string
  vendor: string | null
  category: string | null
  seats: number | null
  renewalDeadline: string | null
  ownerEmployeeId: number | null
  note: string | null
  status: "active" | "cancelled"
  createdAt: string
}

export const seedLicenses: ReadonlyArray<SeedLicense> = [
  {
    id: 1,
    name: "Project Tracker",
    vendor: "Example SaaS Inc",
    category: "saas",
    seats: 50,
    renewalDeadline: "2026-03-31",
    ownerEmployeeId: 1,
    note: null,
    status: "active",
    createdAt: "2026-01-05T00:00:00Z",
  },
  {
    id: 2,
    name: "Design Suite",
    vendor: null,
    category: "software",
    seats: 10,
    renewalDeadline: "2026-06-30",
    ownerEmployeeId: null,
    note: null,
    status: "active",
    createdAt: "2026-01-06T00:00:00Z",
  },
]
