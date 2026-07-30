type SeedCertificateRequest = {
  id: string
  requesterId: number
  certificateType: string
  submitTo: string | null
  neededBy: string | null
  note: string | null
  status: string
  createdAt: string
}

export const seedCertificateRequests: ReadonlyArray<SeedCertificateRequest> = [
  {
    id: "20000000-0000-0000-0000-000000000001",
    requesterId: 2,
    certificateType: "employment",
    submitTo: "市役所",
    neededBy: "2026-06-20",
    note: "保育園申請のため",
    status: "requested",
    createdAt: "2026-06-01T00:00:00.000Z",
  },
  {
    id: "20000000-0000-0000-0000-000000000002",
    requesterId: 4,
    certificateType: "income",
    submitTo: null,
    neededBy: null,
    note: null,
    status: "requested",
    createdAt: "2026-06-01T00:00:00.000Z",
  },
  {
    id: "20000000-0000-0000-0000-000000000003",
    requesterId: 9,
    certificateType: "retirement",
    submitTo: "年金事務所",
    neededBy: "2026-07-05",
    note: null,
    status: "requested",
    createdAt: "2026-06-01T00:00:00.000Z",
  },
]
