import { GetLifecycleState } from "@/application/employee-lifecycle/get-lifecycle-state"
import type { Context } from "@/env"
import { EmployeeLifecycleRepository } from "@/infrastructure/employee-lifecycle/employee-lifecycle-repository"
import { EmployeeRepository } from "@/infrastructure/employee/employee-repository"
import { ApplicationError, UnexpectedError } from "@/lib/errors"

export type LiveEmployeeAccess = {
  status: "active" | "leave"
  source: "lifecycle" | "legacy"
  businessDate: string | null
}

/** verified 後は有効日付き正本、移行中だけは旧列を使う配備互換の認証判定。 */
export async function resolveLiveEmployeeAccess(
  c: Context,
  employeeId: number,
): Promise<LiveEmployeeAccess | null | ApplicationError> {
  const migrationStatus = await new EmployeeLifecycleRepository(c).migrationStatus()
  if (migrationStatus instanceof ApplicationError) return migrationStatus

  if (migrationStatus === "verified") {
    const state = await new GetLifecycleState(c).run({ employeeId })
    if (state instanceof ApplicationError) return state
    if (state.archived || (state.status !== "active" && state.status !== "leave")) return null
    return { status: state.status, source: "lifecycle", businessDate: state.asOf }
  }

  const employee = await new EmployeeRepository(c).findById(employeeId)
  if (employee instanceof Error) {
    return new UnexpectedError("従業員の在籍状態を取得できません", { cause: employee })
  }
  if (employee === null || employee.status === "retired") return null
  return { status: employee.status, source: "legacy", businessDate: null }
}
