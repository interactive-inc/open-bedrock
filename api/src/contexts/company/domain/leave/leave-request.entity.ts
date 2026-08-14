import { leaveStatusSchema, leaveTypeSchema, leaveUnitSchema } from "@/lib/schemas"
import type { LeaveType, LeaveUnit } from "@/lib/schemas"
import type { LeaveRequestRow } from "@/schema"
import { z } from "zod"

/** D1 batch の結果行を安全にパースする。fromRow の引数型に対応する。 */
export const leaveRequestRowSchema = z.object({
  id: z.number(),
  employeeId: z.number(),
  leaveType: leaveTypeSchema,
  startDate: z.string(),
  endDate: z.string(),
  days: z.number(),
  unit: leaveUnitSchema,
  hours: z.number().nullable(),
  consumedDays: z.number(),
  reason: z.string().nullable(),
  status: z.enum(["pending", "approved", "rejected"]),
  approverId: z.number().nullable(),
  decidedComment: z.string().nullable(),
  createdAt: z.string(),
})

const zProps = z.object({
  id: z.number().nullable(),
  employeeId: z.number(),
  leaveType: leaveTypeSchema,
  startDate: z.string(),
  endDate: z.string(),
  days: z.number(),
  unit: leaveUnitSchema,
  hours: z.number().nullable(),
  consumedDays: z.number(),
  reason: z.string().nullable(),
  status: leaveStatusSchema,
  approverId: z.number().nullable(),
  decidedComment: z.string().nullable(),
  createdAt: z.string(),
})

type Props = z.infer<typeof zProps>

const millisecondsPerDay = 24 * 60 * 60 * 1000

/** 休暇申請（社員ごとの期間・日数・状態・承認）。集約ルート。 */
export class LeaveRequest implements Props {
  /** 永続化前は null、DB 採番後に確定する。 */
  readonly id!: Props["id"]

  readonly employeeId!: Props["employeeId"]

  readonly leaveType!: Props["leaveType"]

  readonly startDate!: Props["startDate"]

  readonly endDate!: Props["endDate"]

  readonly days!: Props["days"]

  readonly unit!: Props["unit"]

  readonly hours!: Props["hours"]

  readonly consumedDays!: Props["consumedDays"]

  readonly reason!: Props["reason"]

  readonly status!: Props["status"]

  readonly approverId!: Props["approverId"]

  readonly decidedComment!: Props["decidedComment"]

  readonly createdAt!: Props["createdAt"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)

    Object.freeze(this)
  }

  /** 新規作成する休暇申請を組み立てる。id は未採番、初期状態は pending。 */
  static create(props: {
    employeeId: number
    leaveType: LeaveType
    startDate: string
    endDate: string
    days: number
    unit: LeaveUnit
    hours: number | null
    consumedDays: number
    reason: string | null
    createdAt: string
  }): LeaveRequest {
    return new LeaveRequest({
      id: null,
      employeeId: props.employeeId,
      leaveType: props.leaveType,
      startDate: props.startDate,
      endDate: props.endDate,
      days: props.days,
      unit: props.unit,
      hours: props.hours,
      consumedDays: props.consumedDays,
      reason: props.reason,
      status: "pending",
      approverId: null,
      decidedComment: null,
      createdAt: props.createdAt,
    })
  }

  /** 開始日〜終了日（両端含む）の暦日数を求める。不正な日付・逆転は Error。 */
  static daysBetween(startDate: string, endDate: string): number | Error {
    const start = Date.parse(`${startDate}T00:00:00Z`)

    const end = Date.parse(`${endDate}T00:00:00Z`)

    if (Number.isNaN(start) || Number.isNaN(end)) {
      return new Error("invalid leave date")
    }

    if (end < start) {
      return new Error("end date precedes start date")
    }

    return (end - start) / millisecondsPerDay + 1
  }

  static fromRow(row: LeaveRequestRow): LeaveRequest {
    return new LeaveRequest({
      id: row.id,
      employeeId: row.employeeId,
      leaveType: row.leaveType,
      startDate: row.startDate,
      endDate: row.endDate,
      days: row.days,
      unit: row.unit,
      hours: row.hours,
      consumedDays: row.consumedDays,
      reason: row.reason,
      status: row.status,
      approverId: row.approverId,
      decidedComment: row.decidedComment,
      createdAt: row.createdAt,
    })
  }

  /** pending の申請のみ変更・取り下げできる。決定済みは不可。 */
  get isModifiable(): boolean {
    return this.status === "pending"
  }

  /** 申請内容（種別・期間・日数・理由）を差し替えた新しい申請を返す。 */
  withRevised(props: {
    leaveType: LeaveType
    startDate: string
    endDate: string
    days: number
    unit: LeaveUnit
    hours: number | null
    consumedDays: number
    reason: string | null
  }): LeaveRequest {
    return new LeaveRequest({
      ...this.props,
      leaveType: props.leaveType,
      startDate: props.startDate,
      endDate: props.endDate,
      days: props.days,
      unit: props.unit,
      hours: props.hours,
      consumedDays: props.consumedDays,
      reason: props.reason,
    })
  }
}
