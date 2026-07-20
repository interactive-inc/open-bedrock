/**
 * api/src/attendance/attendance-record-schema.ts と同形。
 * API は snake_case で返す（GET /attendance・/attendance/me の各要素、
 * POST /attendance/clock-in・/attendance/clock-out のレスポンス）。
 * id は attendanceRecords.id（schema 上 integer）なので number。
 * status は open（打刻中）/ closed（退勤済）など api 側の文字列。
 */
export type AttendanceRecord = {
  id: number
  employee_id: number
  work_date: string
  clock_in_at: string | null
  clock_out_at: string | null
  work_minutes: number | null
  status: string
}

/**
 * api/src/attendance/attendance-summary-response-schema.ts と同形。
 * レスポンスは snake_case なので型もそれに合わせる。
 */
export type AttendanceSummary = {
  employee_id: number
  month: string
  work_days: number
  total_work_minutes: number
}

/** GET /attendance /attendance/me のクエリ。null のキーは送信されない。 */
export type AttendanceSearchQuery = {
  employeeId: number | null
  from: string | null
  to: string | null
}

/** GET /attendance/me/summary のクエリ。month 未指定時は api 側で当月を使う。 */
export type AttendanceSummaryQuery = {
  month: string | null
}

/** POST /attendance/clock-in /attendance/clock-out のリクエストボディ。 */
export type AttendanceClockRequest = {
  note: string | null
}
