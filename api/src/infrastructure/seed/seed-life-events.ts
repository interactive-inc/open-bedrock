type SeedLifeEvent = {
  id: string
  employeeId: number
  eventType: string
  eventDate: string
  detail: string | null
  status: string
  createdAt: string
}

export const seedLifeEvents: ReadonlyArray<SeedLifeEvent> = [
  {
    id: "20000000-0000-0000-0000-000000000001",
    employeeId: 2,
    eventType: "marriage",
    eventDate: "2026-05-10",
    detail: "氏名変更の手続きを予定",
    status: "submitted",
    createdAt: "2026-06-01T00:00:00.000Z",
  },
  {
    id: "20000000-0000-0000-0000-000000000002",
    employeeId: 4,
    eventType: "relocation",
    eventDate: "2026-05-20",
    detail: null,
    status: "submitted",
    createdAt: "2026-06-01T00:00:00.000Z",
  },
  {
    id: "20000000-0000-0000-0000-000000000003",
    employeeId: 9,
    eventType: "childbirth",
    eventDate: "2026-06-01",
    detail: "扶養変更の届出を予定",
    status: "submitted",
    createdAt: "2026-06-01T00:00:00.000Z",
  },
]
