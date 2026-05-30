type SeedShiftPattern = {
  id: number
  code: string
  name: string
  startTime: string
  endTime: string
  breakMinutes: number
}

export const seedShiftPatterns: ReadonlyArray<SeedShiftPattern> = [
  { id: 1, code: "EARLY", name: "Early", startTime: "07:00", endTime: "16:00", breakMinutes: 60 },
  { id: 2, code: "LATE", name: "Late", startTime: "13:00", endTime: "22:00", breakMinutes: 60 },
  { id: 3, code: "NIGHT", name: "Night", startTime: "22:00", endTime: "07:00", breakMinutes: 90 },
]
