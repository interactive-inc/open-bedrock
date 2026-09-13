import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { z } from "zod"
import { recordSourceFreezeSnapshotSchema } from "@system/domain/schemas/records/record-source-freeze.schema"

/** 勤怠記録 1 件のレスポンス。 */
export const zAppAttendanceRecord = z.object({
  id: z.number(),
  employee_id: zEmployeeId,
  work_date: z.string(),
  clock_in_at: z.string().nullable(),
  clock_out_at: z.string().nullable(),
  work_minutes: z.number().nullable(),
  status: z.string(),
})

/** 勤怠記録一覧のレスポンス。 */
export const zAppAttendanceRecordList = z.object({
  data: z.array(zAppAttendanceRecord),
  total: z.number(),
})

/** 本人の指定月の勤怠集計レスポンス。 */
export const zAppAttendanceSummary = z.object({
  employee_id: zEmployeeId,
  month: z.string(),
  work_days: z.number(),
  total_work_minutes: z.number(),
})

/** 書込み停止世代の現在の状態。撤去可否の判定とは独立する。 */
export const zAppAttendanceSourceFreeze = z.strictObject({
  freeze: recordSourceFreezeSnapshotSchema,
})

/** 照合ページの受領情報。本文、SQL検査、撤去許可は含めない。 */
export const zAppAttendanceCoveragePageReceipt = z.strictObject({
  id: z.uuid(),
  freezeId: z.uuid(),
  sequence: z.number().int().positive().safe(),
  digest: z.string().regex(/^[0-9a-f]{64}$/),
  afterCursor: z.string().nullable(),
  nextCursor: z.string().nullable(),
  checkedAt: z.string().datetime(),
  recordCount: z.number().int().min(0).max(10),
})
