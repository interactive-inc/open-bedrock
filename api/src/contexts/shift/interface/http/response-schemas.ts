import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { z } from "zod"

/** シフトパターン 1 件のレスポンス。 */
export const zAppShiftPattern = z.object({
  id: z.number(),
  code: z.string(),
  name: z.string(),
  start_time: z.string(),
  end_time: z.string(),
  break_minutes: z.number(),
})

/** シフトパターン一覧のレスポンス。 */
export const zAppShiftPatternList = z.object({
  data: z.array(zAppShiftPattern),
  total: z.number(),
})

/** シフト割当 1 件のレスポンス。 */
export const zAppShiftAssignment = z.object({
  id: z.number(),
  employee_id: zEmployeeId,
  pattern_id: z.number().nullable(),
  date: z.string(),
  note: z.string().nullable(),
  published_at: z.string().nullable(),
})

/** シフト割当一覧のレスポンス。 */
export const zAppShiftAssignmentList = z.object({
  data: z.array(zAppShiftAssignment),
  total: z.number(),
})

/** 本人向けシフト割当 1 件のレスポンス。パターン名・時間帯を埋めて返す（member はパターン一覧を閲覧できないため）。 */
export const zAppMyShiftAssignment = z.object({
  id: z.number(),
  employee_id: zEmployeeId,
  pattern_id: z.number().nullable(),
  pattern_name: z.string().nullable(),
  pattern_start_time: z.string().nullable(),
  pattern_end_time: z.string().nullable(),
  date: z.string(),
  note: z.string().nullable(),
  published_at: z.string().nullable(),
})

/** 本人向けシフト割当一覧のレスポンス。 */
export const zAppMyShiftAssignmentList = z.object({
  data: z.array(zAppMyShiftAssignment),
  total: z.number(),
})

/** シフト交代申請 1 件のレスポンス（社員 ID で表現）。 */
export const zAppShiftSwapRequest = z.object({
  id: z.number(),
  requester_employee_id: zEmployeeId,
  target_employee_id: zEmployeeId,
  date: z.string(),
  note: z.string().nullable(),
  status: z.string(),
  approved_at: z.string().nullable(),
})

/** 本人向けシフト交代申請 1 件のレスポンス。交代相手の氏名を埋めて返す（member は社員 ID から氏名を引けないため）。 */
export const zAppMyShiftSwapRequest = z.object({
  id: z.number(),
  requester_employee_id: zEmployeeId,
  target_employee_id: zEmployeeId,
  target_employee_name: z.string().nullable(),
  date: z.string(),
  note: z.string().nullable(),
  status: z.string(),
  approved_at: z.string().nullable(),
})

/** 本人向けシフト交代申請一覧のレスポンス。 */
export const zAppMyShiftSwapRequestList = z.object({
  data: z.array(zAppMyShiftSwapRequest),
  total: z.number(),
})

/** 承認待ちシフト交代申請一覧の要素（社員コードで表現）。 */
export const zAppShiftSwapRequestPending = z.object({
  id: z.number(),
  requester_employee_code: z.string(),
  target_employee_code: z.string(),
  date: z.string(),
  note: z.string().nullable(),
  status: z.string(),
  approved_at: z.string().nullable(),
})

/** 承認待ちシフト交代申請一覧のレスポンス。 */
export const zAppShiftSwapRequestPendingList = z.object({
  data: z.array(zAppShiftSwapRequestPending),
  total: z.number(),
})

/** 全社シフト交代申請一覧（GET /shift-swap-requests/admin）の 1 件。社員名・部署も付与する。 */
export const zAppShiftSwapRequestAdminItem = z.object({
  id: z.number(),
  requester_employee_id: zEmployeeId,
  requester_employee_code: z.string(),
  requester_name: z.string(),
  requester_dept_name: z.string().nullable(),
  target_employee_id: zEmployeeId,
  target_employee_code: z.string(),
  target_name: z.string(),
  date: z.string(),
  note: z.string().nullable(),
  status: z.string(),
  approved_at: z.string().nullable(),
})

/** 全社シフト交代申請一覧のレスポンス。 */
export const zAppShiftSwapRequestAdminList = z.object({
  data: z.array(zAppShiftSwapRequestAdminItem),
  total: z.number(),
})
