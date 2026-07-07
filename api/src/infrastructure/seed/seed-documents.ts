type SeedDocument = {
  id: number
  title: string
  category: string | null
  location: string
  partnerCode: string | null
  expiresOn: string | null
  note: string | null
  createdAt: string
}

export const seedDocuments: ReadonlyArray<SeedDocument> = [
  {
    id: 1,
    title: "Office Lease Agreement",
    category: "contract",
    location: "cabinet-A/lease",
    partnerCode: "P0001",
    expiresOn: "2027-03-31",
    note: null,
    createdAt: "2026-01-05T09:00:00Z",
  },
  {
    id: 2,
    title: "Business License",
    category: "license",
    location: "https://example.com/docs/license",
    partnerCode: null,
    expiresOn: "2026-09-30",
    note: "renew before expiry",
    createdAt: "2026-01-06T09:00:00Z",
  },
  {
    id: 3,
    title: "Company Handbook",
    category: null,
    location: "cabinet-B/handbook",
    partnerCode: null,
    expiresOn: null,
    note: null,
    createdAt: "2026-01-07T09:00:00Z",
  },
]
