import { and, eq, isNull } from "drizzle-orm"
import type { Context } from "@/env"
import { EmployeeLifecycleReadRepository } from "@/infrastructure/employee-lifecycle/employee-lifecycle-read-repository"
import { EmployeeLifecycleRepository } from "@/infrastructure/employee-lifecycle/employee-lifecycle-repository"
import { employees, orgDepartments } from "@/schema"

export type EmployeeActiveResult =
  | { valid: true }
  | {
      valid: false
      code: "not_found" | "archived" | "not_active" | "retired" | "department_archived"
      message: string
    }

/**
 * 従業員が active/leave かつ非 archived であることを検証する。
 *
 * lifecycle migration が "verified" の場合は EmployeeLifecycleReadRepository.findStatesAt() を使い、
 * active/leave かつ非 archived かつ所属部門が非 archived であることを確認する。
 * それ以外は employees テーブルから直接判定する（レガシーパス）。
 *
 * resolve-workflow-approver-matches.ts の loadWorkflowOrganization() と同一の判定基準を共有する。
 */
export async function validateEmployeeActive(
  c: Context,
  employeeId: number,
  businessDate: string,
): Promise<EmployeeActiveResult | Error> {
  try {
    const migrationStatus = await new EmployeeLifecycleRepository(c).migrationStatus()

    if (migrationStatus instanceof Error) {
      return migrationStatus
    }

    if (migrationStatus === "verified") {
      return validateViaLifecycle(c, employeeId, businessDate)
    }

    return validateViaLegacy(c, employeeId)
  } catch (error) {
    return error instanceof Error ? error : new Error("failed to validate employee active status")
  }
}

async function validateViaLifecycle(
  c: Context,
  employeeId: number,
  businessDate: string,
): Promise<EmployeeActiveResult> {
  const states = await new EmployeeLifecycleReadRepository(c).findStatesAt(
    [employeeId],
    businessDate,
  )

  if (states instanceof Error) {
    throw states
  }

  const state = states.get(employeeId)

  if (state === undefined) {
    return { valid: false, code: "not_found", message: "employee not found" }
  }

  if (state.archived) {
    return { valid: false, code: "archived", message: "employee is archived" }
  }

  if (state.status !== "active" && state.status !== "leave") {
    return { valid: false, code: "not_active", message: "employee is not active" }
  }

  // 所属部門が archived でないことを確認（resolve-workflow-approver-matches.ts 同様）
  if (state.primaryAssignment !== null) {
    const activeDeptRows = await c.var.database
      .select({ code: orgDepartments.code })
      .from(orgDepartments)
      .where(
        and(
          eq(orgDepartments.code, state.primaryAssignment.departmentCode),
          isNull(orgDepartments.archivedAt),
        ),
      )
      .limit(1)

    if (activeDeptRows.length === 0) {
      return {
        valid: false,
        code: "department_archived",
        message: "employee belongs to an archived department",
      }
    }
  }

  return { valid: true }
}

async function validateViaLegacy(c: Context, employeeId: number): Promise<EmployeeActiveResult> {
  const rows = await c.var.database
    .select({
      id: employees.id,
      status: employees.status,
      archivedAt: employees.archivedAt,
    })
    .from(employees)
    .where(eq(employees.id, employeeId))
    .limit(1)

  const row = rows.at(0)

  if (row === undefined) {
    return { valid: false, code: "not_found", message: "employee not found" }
  }

  if (row.archivedAt !== null) {
    return { valid: false, code: "archived", message: "employee is archived" }
  }

  if (row.status === "retired") {
    return { valid: false, code: "retired", message: "employee is retired" }
  }

  return { valid: true }
}
