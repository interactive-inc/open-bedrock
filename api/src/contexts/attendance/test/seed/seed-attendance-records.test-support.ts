export type SeedAttendanceRecord = {
  id: number
  employeeId: number
  workDate: string
  clockInAt: string | null
  clockOutAt: string | null
  workMinutes: number | null
  status: string
}

/**
 * seed-employees の既存社員 id（5, 9 など member）に紐付ける。
 * status は "closed"（退勤済・workMinutes 確定）と
 * "open"（出勤中・退勤前なので clockOutAt/workMinutes は null）の2系統。
 * workDate は "YYYY-MM-DD"、clockInAt/clockOutAt は ISO8601。
 */
export const seedAttendanceRecords: ReadonlyArray<SeedAttendanceRecord> = [
  {
    id: 1,
    employeeId: 5,
    workDate: "2026-05-25",
    clockInAt: "2026-05-25T09:00:00Z",
    clockOutAt: "2026-05-25T18:00:00Z",
    workMinutes: 540,
    status: "closed",
  },
  {
    id: 2,
    employeeId: 5,
    workDate: "2026-05-26",
    clockInAt: "2026-05-26T09:00:00Z",
    clockOutAt: "2026-05-26T17:30:00Z",
    workMinutes: 510,
    status: "closed",
  },
  {
    id: 3,
    employeeId: 9,
    workDate: "2026-05-25",
    clockInAt: "2026-05-25T10:00:00Z",
    clockOutAt: "2026-05-25T18:00:00Z",
    workMinutes: 480,
    status: "closed",
  },
  {
    id: 4,
    employeeId: 9,
    workDate: "2026-05-29",
    clockInAt: "2026-05-29T09:15:00Z",
    clockOutAt: null,
    workMinutes: null,
    status: "open",
  },
]
