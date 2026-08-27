import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
type SeedLifeEvent = {
  id: string
  employeeId: EmployeeId
  eventType: string
  eventDate: string
  detail: string | null
  status: string
  createdAt: string
}

export const seedLifeEvents: ReadonlyArray<SeedLifeEvent> = [
  {
    id: "20000000-0000-0000-0000-000000000001",
    employeeId: toWorkforceEmployeeId(2),
    eventType: "marriage",
    eventDate: "2026-05-10",
    detail: "氏名変更の手続きを予定",
    status: "submitted",
    createdAt: "2026-06-01T00:00:00.000Z",
  },
  {
    id: "20000000-0000-0000-0000-000000000002",
    employeeId: toWorkforceEmployeeId(4),
    eventType: "relocation",
    eventDate: "2026-05-20",
    detail: null,
    status: "submitted",
    createdAt: "2026-06-01T00:00:00.000Z",
  },
  {
    id: "20000000-0000-0000-0000-000000000003",
    employeeId: toWorkforceEmployeeId(9),
    eventType: "childbirth",
    eventDate: "2026-06-01",
    detail: "扶養変更の届出を予定",
    status: "submitted",
    createdAt: "2026-06-01T00:00:00.000Z",
  },
  {
    id: "20000000-0000-0000-0000-000000000004",
    employeeId: toWorkforceEmployeeId(5),
    eventType: "divorce",
    eventDate: "2026-05-15",
    detail: null,
    status: "submitted",
    createdAt: "2026-06-01T00:00:00.000Z",
  },
  {
    id: "20000000-0000-0000-0000-000000000005",
    employeeId: toWorkforceEmployeeId(10),
    eventType: "dependent_added",
    eventDate: "2026-06-01",
    detail: "子を扶養に追加",
    status: "submitted",
    createdAt: "2026-06-01T00:00:00.000Z",
  },
  {
    id: "20000000-0000-0000-0000-000000000006",
    employeeId: toWorkforceEmployeeId(13),
    eventType: "dependent_removed",
    eventDate: "2026-05-25",
    detail: "配偶者の就職により扶養から削除",
    status: "submitted",
    createdAt: "2026-06-01T00:00:00.000Z",
  },
]
