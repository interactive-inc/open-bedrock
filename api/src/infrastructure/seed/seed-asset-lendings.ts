type SeedAssetLending = {
  id: number
  assetCode: string
  employeeId: number
  lentAt: string
  returnedAt: string | null
}

/** lent 状態の資産には returnedAt:null の open レコードを対応させる。 */
export const seedAssetLendings: ReadonlyArray<SeedAssetLending> = [
  {
    id: 1,
    assetCode: "A0001",
    employeeId: 5,
    lentAt: "2026-04-01T09:00:00Z",
    returnedAt: null,
  },
  {
    id: 2,
    assetCode: "A0002",
    employeeId: 9,
    lentAt: "2026-04-01T09:00:00Z",
    returnedAt: null,
  },
  {
    id: 3,
    assetCode: "A0003",
    employeeId: 5,
    lentAt: "2025-12-01T09:00:00Z",
    returnedAt: "2026-03-31T18:00:00Z",
  },
]
