import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { leaveTypeSchema } from "@/lib/schemas"
import type { LeaveBalanceRow } from "@/contexts/leave/infrastructure/schema/leave"
import { z } from "zod"

const zProps = z.object({
  employeeId: zEmployeeId,
  fiscalYear: z.string(),
  leaveType: leaveTypeSchema,
  grantedDays: z.number(),
  usedDays: z.number(),
  remainingDays: z.number(),
})

type Props = z.infer<typeof zProps>

/** 年度ごとの休暇残数。employeeId × fiscalYear × leaveType を論理キーとする集約ルート。 */
export class LeaveBalance implements Props {
  readonly employeeId!: Props["employeeId"]

  readonly fiscalYear!: Props["fiscalYear"]

  readonly leaveType!: Props["leaveType"]

  readonly grantedDays!: Props["grantedDays"]

  readonly usedDays!: Props["usedDays"]

  readonly remainingDays!: Props["remainingDays"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)

    Object.freeze(this)
  }

  static fromRow(row: LeaveBalanceRow): LeaveBalance {
    return new LeaveBalance({
      employeeId: row.employeeId,
      fiscalYear: row.fiscalYear,
      leaveType: row.leaveType,
      grantedDays: row.grantedDays,
      usedDays: row.usedDays,
      remainingDays: row.remainingDays,
    })
  }

  decrement(days: number): LeaveBalance | { reason: "invalid_decrement" } {
    if (days <= 0 || days > this.props.remainingDays) {
      return { reason: "invalid_decrement" }
    }

    return new LeaveBalance({
      ...this.props,
      usedDays: this.props.usedDays + days,
      remainingDays: this.props.remainingDays - days,
    })
  }
}
