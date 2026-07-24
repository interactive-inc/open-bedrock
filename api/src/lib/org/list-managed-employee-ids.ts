import type { Context } from "@/env"
import { employees, orgDepartments, orgMemberships } from "@/schema"
import { EmployeeLifecycleRepository } from "@/infrastructure/employee-lifecycle/employee-lifecycle-repository"
import { isInManagementChain } from "@/lib/org/is-in-management-chain"
import { listLifecycleManagedEmployeeIds } from "@/lib/org/list-lifecycle-managed-employee-ids"

/** actor が管理できる社員IDを返す。受信箱の絞り込みに使う。 */
export async function listManagedEmployeeIds(
  c: Context,
  actorEmployeeId: number,
): Promise<ReadonlyArray<number> | Error> {
  const migrationStatus = await new EmployeeLifecycleRepository(c).migrationStatus()
  if (migrationStatus instanceof Error) return migrationStatus
  if (migrationStatus === "verified") {
    return listLifecycleManagedEmployeeIds(c, actorEmployeeId)
  }

  try {
    const employeeRows = await c.var.database
      .select({ id: employees.id, code: employees.code })
      .from(employees)

    const actorCode = employeeRows.find((employee) => employee.id === actorEmployeeId)?.code

    // 社員コードを持たない actor（外部プロビジョニングの code=null）は組織図に載らず、誰も管理しない。
    if (actorCode === undefined || actorCode === null) {
      return []
    }

    const [membershipRows, departmentRows] = await Promise.all([
      c.var.database.select().from(orgMemberships),
      c.var.database.select().from(orgDepartments),
    ])

    const managersByEmployee = new Map<string, Set<string>>()
    const departmentsByEmployee = new Map<string, Set<string>>()

    for (const membership of membershipRows) {
      const departmentCodes = departmentsByEmployee.get(membership.employeeCode) ?? new Set()

      departmentCodes.add(membership.departmentCode)
      departmentsByEmployee.set(membership.employeeCode, departmentCodes)

      if (membership.managerEmployeeCode !== null) {
        const managers = managersByEmployee.get(membership.employeeCode) ?? new Set()

        managers.add(membership.managerEmployeeCode)
        managersByEmployee.set(membership.employeeCode, managers)
      }
    }

    const managedDepartmentCodes = new Set(
      departmentRows
        .filter((department) => department.managerEmployeeCode === actorCode)
        .map((department) => department.code),
    )

    return employeeRows
      .filter((employee) => {
        if (employee.id === actorEmployeeId) {
          return false
        }

        // code=null の従業員は組織メンバーシップを持たず、管理対象になり得ない。
        if (employee.code === null) {
          return false
        }

        const inChain = isInManagementChain({
          actorCode,
          targetCode: employee.code,
          managersByEmployee,
        })

        const inManagedDepartment = [...(departmentsByEmployee.get(employee.code) ?? [])].some(
          (departmentCode) => managedDepartmentCodes.has(departmentCode),
        )

        return inChain || inManagedDepartment
      })
      .map((employee) => employee.id)
  } catch (error) {
    return error instanceof Error ? error : new Error("failed to list managed employees")
  }
}
