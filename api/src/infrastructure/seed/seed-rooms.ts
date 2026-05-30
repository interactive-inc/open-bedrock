type SeedRoom = {
  id: number
  name: string
  capacity: number
  location: string | null
}

export const seedRooms: ReadonlyArray<SeedRoom> = [
  { id: 1, name: "Large Meeting Room A", capacity: 20, location: "5F" },
  { id: 2, name: "Medium Meeting Room B", capacity: 10, location: "5F" },
  { id: 3, name: "Small Meeting Room C", capacity: 6, location: "4F" },
  { id: 4, name: "Focus Booth 1", capacity: 2, location: "4F" },
  { id: 5, name: "Online Meeting Room", capacity: 8, location: null },
]
