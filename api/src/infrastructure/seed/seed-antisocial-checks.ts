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
    partnerName: "株式会社サンプル商事",
    partnerAddress: "東京都サンプル区サンプル1-2-3",
    representativeName: "山田 サンプル",
    result: null,
    status: "requested",
    createdAt: "2026-06-01T00:00:00.000Z",
  },
  {
    id: "20000000-0000-0000-0000-000000000002",
    requesterId: 4,
    partnerName: "サンプル物流株式会社",
    partnerAddress: null,
    representativeName: null,
    result: null,
    status: "requested",
    createdAt: "2026-06-01T00:00:00.000Z",
  },
  {
    id: "20000000-0000-0000-0000-000000000003",
    requesterId: 9,
    partnerName: "デモパートナーズ合同会社",
    partnerAddress: "大阪府サンプル市サンプル4-5-6",
    representativeName: "鈴木 サンプル",
    result: null,
    status: "requested",
    createdAt: "2026-06-01T00:00:00.000Z",
  },
]
