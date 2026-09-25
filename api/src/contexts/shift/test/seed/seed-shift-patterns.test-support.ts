type SeedShiftPattern = {
  id: string
  code: string
  name: string
  startTime: string
  endTime: string
  breakMinutes: number
}

export const seedShiftPatterns: ReadonlyArray<SeedShiftPattern> = [
  {
    id: "01900023-0000-7000-8000-000000000001",
    code: "EARLY",
    name: "早番",
    startTime: "07:00",
    endTime: "16:00",
    breakMinutes: 60,
  },
  {
    id: "01900023-0000-7000-8000-000000000002",
    code: "LATE",
    name: "遅番",
    startTime: "13:00",
    endTime: "22:00",
    breakMinutes: 60,
  },
  {
    id: "01900023-0000-7000-8000-000000000003",
    code: "NIGHT",
    name: "夜勤",
    startTime: "22:00",
    endTime: "07:00",
    breakMinutes: 90,
  },
]
