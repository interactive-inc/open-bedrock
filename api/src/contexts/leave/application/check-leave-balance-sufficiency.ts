import { LeaveBalanceRepository } from "@/contexts/leave/infrastructure/leave-balance-repository"
import type { Context } from "@/env"
import { ConflictError, UnexpectedError, ValidationError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { hasLeaveBalanceTracking } from "@/contexts/leave/domain/has-balance-tracking"
import { toFiscalYear } from "@/contexts/leave/domain/to-fiscal-year"
import type { LeaveType } from "@/lib/schemas"

/** 残高管理対象の種別のみ、申請時点で残数が足りるか確認する。対象外の種別は常に null（許可）。 */
export async function checkLeaveBalanceSufficiency(
  c: Context,
  props: {
    employeeId: number
    leaveType: LeaveType
    startDate: string
    consumedDays: number
  },
): Promise<ApplicationError | null> {
  if (hasLeaveBalanceTracking(props.leaveType) === false) {
    return null
  }

  const fiscalYear = toFiscalYear(props.startDate)

  if (fiscalYear === null) {
    return new ValidationError("invalid leave request start date", "invalid_start_date")
  }

  const balance = await new LeaveBalanceRepository(c).findByKey({
    employeeId: props.employeeId,
    fiscalYear,
    leaveType: props.leaveType,
  })

  if (balance instanceof Error) {
    return new UnexpectedError("failed to load leave balance", { cause: balance })
  }

  if (balance === null) {
    return new ConflictError("leave balance record not found", "balance_not_found")
  }

  if (balance.remainingDays < props.consumedDays) {
    return new ConflictError("insufficient leave balance", "insufficient_balance")
  }

  return null
}
