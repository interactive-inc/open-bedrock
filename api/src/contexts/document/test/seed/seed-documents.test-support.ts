type SeedDocument = {
  id: string
  title: string
  category: string | null
  location: string
  counterpartyReference: string | null
  expiresOn: string | null
  note: string | null
  createdAt: string
}

export const seedDocuments: ReadonlyArray<SeedDocument> = [
  {
    id: "01900012-0000-7000-8000-000000000001",
    title: "オフィス賃貸借契約書",
    category: "contract",
    location: "cabinet-A/lease",
    counterpartyReference: "P0001",
    expiresOn: "2027-03-31",
    note: null,
    createdAt: "2026-01-05T09:00:00Z",
  },
  {
    id: "01900012-0000-7000-8000-000000000002",
    title: "事業許可証",
    category: "license",
    location: "https://example.com/docs/license",
    counterpartyReference: null,
    expiresOn: "2026-09-30",
    note: "期限前に更新すること",
    createdAt: "2026-01-06T09:00:00Z",
  },
  {
    id: "01900012-0000-7000-8000-000000000003",
    title: "従業員ハンドブック",
    category: null,
    location: "cabinet-B/handbook",
    counterpartyReference: null,
    expiresOn: null,
    note: null,
    createdAt: "2026-01-07T09:00:00Z",
  },
]
