// api/src/attendance の *-schema.ts と同形の手書き type。
// api と疎結合にするため api 側からは import しない。

// api/src/attendance/attendance-record-schema.ts と同形。
// status は open（打刻中）/ closed（退勤済）など api 側の文字列。
export type AttendanceRecord = {
  id: number
  employeeId: number
  workDate: string
  clockInAt: string | null
  clockOutAt: string | null
  workMinutes: number | null
  status: string
}

// api/src/attendance/attendance-summary-response-schema.ts と同形。
// レスポンスは snake_case なので型もそれに合わせる。
export type AttendanceSummary = {
  employee_id: number
  month: string
  work_days: number
  total_work_minutes: number
}

// GET /attendance /attendance/me のクエリ。null のキーは送信されない。
export type AttendanceSearchQuery = {
  employeeId: number | null
  from: string | null
  to: string | null
}

// GET /attendance/me/summary のクエリ。month 未指定時は api 側で当月を使う。
export type AttendanceSummaryQuery = {
  month: string | null
}

// POST /attendance/clock-in /attendance/clock-out のリクエストボディ。
export type AttendanceClockRequest = {
  note: string | null
}
