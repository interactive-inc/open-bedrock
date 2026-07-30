type SeedRoom = {
  id: number
  name: string
  capacity: number
  location: string | null
}

export const seedRooms: ReadonlyArray<SeedRoom> = [
  { id: 1, name: "大会議室A", capacity: 20, location: "5階" },
  { id: 2, name: "中会議室B", capacity: 10, location: "5階" },
  { id: 3, name: "小会議室C", capacity: 6, location: "4階" },
  { id: 4, name: "集中ブース1", capacity: 2, location: "4階" },
  { id: 5, name: "オンライン会議室", capacity: 8, location: null },
]
