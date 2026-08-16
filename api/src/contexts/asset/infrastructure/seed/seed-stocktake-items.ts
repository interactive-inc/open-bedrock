type SeedStocktakeItem = {
  stocktakeId: string
  assetCode: string
  checkedAt: string | null
  checkerEmployeeId: number | null
  locationNote: string | null
}

export const seedStocktakeItems: ReadonlyArray<SeedStocktakeItem> = [
  {
    stocktakeId: "a1b2c3d4-e5f6-4a1b-8c2d-000000000001",
    assetCode: "A0001",
    checkedAt: "2026-04-02T10:00:00Z",
    checkerEmployeeId: 1,
    locationNote: "5F 開発席",
  },
  {
    stocktakeId: "a1b2c3d4-e5f6-4a1b-8c2d-000000000001",
    assetCode: "A0002",
    checkedAt: null,
    checkerEmployeeId: null,
    locationNote: null,
  },
  {
    stocktakeId: "a1b2c3d4-e5f6-4a1b-8c2d-000000000001",
    assetCode: "A0003",
    checkedAt: null,
    checkerEmployeeId: null,
    locationNote: null,
  },
  {
    stocktakeId: "a1b2c3d4-e5f6-4a1b-8c2d-000000000001",
    assetCode: "A0004",
    checkedAt: null,
    checkerEmployeeId: null,
    locationNote: null,
  },
  {
    stocktakeId: "a1b2c3d4-e5f6-4a1b-8c2d-000000000001",
    assetCode: "A0010",
    checkedAt: null,
    checkerEmployeeId: null,
    locationNote: null,
  },
  {
    stocktakeId: "a1b2c3d4-e5f6-4a1b-8c2d-000000000002",
    assetCode: "A0001",
    checkedAt: "2025-10-03T11:00:00Z",
    checkerEmployeeId: 1,
    locationNote: "5F 開発席",
  },
  {
    stocktakeId: "a1b2c3d4-e5f6-4a1b-8c2d-000000000002",
    assetCode: "A0003",
    checkedAt: "2025-10-03T11:10:00Z",
    checkerEmployeeId: 1,
    locationNote: "倉庫",
  },
]
