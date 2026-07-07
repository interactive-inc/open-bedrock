type SeedPartner = {
  id: number
  code: string
  name: string
  category: string | null
  corporateNumber: string | null
  note: string | null
  status: string
  createdAt: string
}

export const seedPartners: ReadonlyArray<SeedPartner> = [
  {
    id: 1,
    code: "P0001",
    name: "Acme Supplies",
    category: "supplier",
    corporateNumber: "1234567890123",
    note: null,
    status: "active",
    createdAt: "2026-01-05T09:00:00Z",
  },
  {
    id: 2,
    code: "P0002",
    name: "Beta Trading",
    category: "customer",
    corporateNumber: null,
    note: null,
    status: "active",
    createdAt: "2026-01-06T09:00:00Z",
  },
  {
    id: 3,
    code: "P0003",
    name: "Gamma Legacy",
    category: "other",
    corporateNumber: null,
    note: "past partner",
    status: "archived",
    createdAt: "2025-06-01T09:00:00Z",
  },
]
