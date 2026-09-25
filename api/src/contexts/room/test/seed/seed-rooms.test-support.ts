type SeedRoom = {
  id: string
  name: string
  capacity: number
  location: string | null
}

export const seedRooms: ReadonlyArray<SeedRoom> = [
  { id: "01900022-0000-7000-8000-000000000001", name: "大会議室A", capacity: 20, location: "5階" },
  { id: "01900022-0000-7000-8000-000000000002", name: "中会議室B", capacity: 10, location: "5階" },
  { id: "01900022-0000-7000-8000-000000000003", name: "小会議室C", capacity: 6, location: "4階" },
  { id: "01900022-0000-7000-8000-000000000004", name: "集中ブース1", capacity: 2, location: "4階" },
  {
    id: "01900022-0000-7000-8000-000000000005",
    name: "オンライン会議室",
    capacity: 8,
    location: null,
  },
]
