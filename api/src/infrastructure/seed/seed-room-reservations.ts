type SeedRoomReservation = {
  id: string
  roomId: number
  reserverId: number
  startAt: string
  endAt: string
  purpose: string | null
}

export const seedRoomReservations: ReadonlyArray<SeedRoomReservation> = [
  {
    id: "00000000-0000-0000-0000-000000000001",
    roomId: 1,
    reserverId: 2,
    startAt: "2026-05-29T01:00:00Z",
    endAt: "2026-05-29T02:00:00Z",
    purpose: "All-hands standup",
  },
  {
    id: "00000000-0000-0000-0000-000000000002",
    roomId: 2,
    reserverId: 4,
    startAt: "2026-05-29T03:00:00Z",
    endAt: "2026-05-29T04:00:00Z",
    purpose: "Sprint review",
  },
  {
    id: "00000000-0000-0000-0000-000000000003",
    roomId: 1,
    reserverId: 9,
    startAt: "2026-05-29T05:00:00Z",
    endAt: "2026-05-29T06:00:00Z",
    purpose: "Sales strategy meeting",
  },
]
