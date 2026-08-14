type SeedRentalReservation = {
  id: string
  requesterId: number
  itemName: string
  startDate: string
  endDate: string
  purpose: string | null
  status: "requested"
  createdAt: string
}

export const seedRentalReservations: ReadonlyArray<SeedRentalReservation> = [
  {
    id: "10000000-0000-0000-0000-000000000001",
    requesterId: 2,
    itemName: "プロジェクター",
    startDate: "2026-06-10",
    endDate: "2026-06-12",
    purpose: "取引先向けプレゼンテーション",
    status: "requested",
    createdAt: "2026-06-01T00:00:00Z",
  },
  {
    id: "10000000-0000-0000-0000-000000000002",
    requesterId: 4,
    itemName: "ノートPC",
    startDate: "2026-06-15",
    endDate: "2026-06-20",
    purpose: null,
    status: "requested",
    createdAt: "2026-06-01T00:00:00Z",
  },
  {
    id: "10000000-0000-0000-0000-000000000003",
    requesterId: 9,
    itemName: "カメラ",
    startDate: "2026-06-18",
    endDate: "2026-06-19",
    purpose: "イベント撮影",
    status: "requested",
    createdAt: "2026-06-01T00:00:00Z",
  },
]
