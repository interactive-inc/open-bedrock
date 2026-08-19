type SeedEmployeeEvent = {
  id: number
  employeeId: number
  kind: string
  effectiveDate: string
  fromDepartmentCode: string | null
  toDepartmentCode: string | null
  note: string | null
  createdAt: string
}

export const seedEmployeeEvents: ReadonlyArray<SeedEmployeeEvent> = [
  {
    id: 1,
    employeeId: 5,
    kind: "join",
    effectiveDate: "2024-04-01",
    fromDepartmentCode: null,
    toDepartmentCode: "D003",
    note: "新卒入社",
    createdAt: "2024-04-01T00:00:00.000Z",
  },
  {
    id: 2,
    employeeId: 5,
    kind: "transfer",
    effectiveDate: "2025-10-01",
    fromDepartmentCode: "D003",
    toDepartmentCode: "D003",
    note: "チーム異動",
    createdAt: "2025-10-01T00:00:00.000Z",
  },
  {
    id: 3,
    employeeId: 9,
    kind: "join",
    effectiveDate: "2023-04-01",
    fromDepartmentCode: null,
    toDepartmentCode: "D004",
    note: null,
    createdAt: "2023-04-01T00:00:00.000Z",
  },
]
