import type { LeaveRequestRow } from "@/schema"
import { z } from "zod"

const zProps = z.object({
  id: z.number().nullable(),
  employeeId: z.number(),
  leaveType: z.enum(["annual", "special"]),
  startDate: z.string(),
  endDate: z.string(),
  days: z.number(),
  reason: z.string().nullable(),
  status: z.enum(["pending", "approved", "rejected"]),
  approverId: z.number().nullable(),
  decidedComment: z.string().nullable(),
  createdAt: z.string(),
})

type Props = z.infer<typeof zProps>

// 休暇申請（社員ごとの期間・日数・状態・承認）。集約ルート。
export class LeaveRequest implements Props {
  // 永続化前は null、DB 採番後に確定する。
  readonly id!: Props["id"]

  readonly employeeId!: Props["employeeId"]

  readonly leaveType!: Props["leaveType"]

  readonly startDate!: Props["startDate"]

  readonly endDate!: Props["endDate"]

  readonly days!: Props["days"]

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

  // 新規作成する休暇申請を組み立てる。id は未採番、初期状態は pending。
  static create(props: {
    employeeId: number
    leaveType: "annual" | "special"
    startDate: string
    endDate: string
    days: number
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
      reason: props.reason,
      status: "pending",
      approverId: null,
      decidedComment: null,
      createdAt: props.createdAt,
    })
  }

  static fromRow(row: LeaveRequestRow): LeaveRequest {
    return new LeaveRequest({
      id: row.id,
      employeeId: row.employeeId,
      leaveType: row.leaveType,
      startDate: row.startDate,
      endDate: row.endDate,
      days: row.days,
      reason: row.reason,
      status: row.status,
      approverId: row.approverId,
      decidedComment: row.decidedComment,
      createdAt: row.createdAt,
    })
  }

  decide(props: {
    status: "approved" | "rejected"
    approverId: number
    decidedComment: string | null
  }) {
    return new LeaveRequest({
      ...this.props,
      status: props.status,
      approverId: props.approverId,
      decidedComment: props.decidedComment,
    })
  }
}
