import type { Context } from "@/env"
import { employees } from "@/contexts/company/infrastructure/schema/employee"
import {
  orgDepartments,
  orgMemberships,
} from "@/contexts/company/infrastructure/schema/organization"
import { inArray } from "drizzle-orm"
import { isInManagementChain } from "@/contexts/company/domain/organization/is-in-management-chain"
import type { OrganizationAuthority } from "@/contexts/company/domain/organization/organization-authority"

const noAuthority: OrganizationAuthority = {
  directManager: false,
  departmentManager: false,
  managementChain: false,
}

/**
 * legacy組織投影で actor が target に対して持つ管理関係を解決する。
 */
export async function resolveLegacyOrganizationAuthority(
  c: Context,
  actorEmployeeId: number,
  targetEmployeeId: number,
): Promise<OrganizationAuthority | Error> {
  if (actorEmployeeId === targetEmployeeId) {
    return noAuthority
  }

  try {
    const employeeRows = await c.var.database
      .select({ id: employees.id, code: employees.code })
      .from(employees)
      .where(inArray(employees.id, [actorEmployeeId, targetEmployeeId]))

    const codeById = new Map(employeeRows.map((row) => [row.id, row.code] as const))

    const actorCode = codeById.get(actorEmployeeId)
    const targetCode = codeById.get(targetEmployeeId)

    // どちらかが社員コードを持たない（code=null）なら組織図に載らず、管理関係は成立しない。
    if (actorCode === undefined || actorCode === null) return noAuthority
    if (targetCode === undefined || targetCode === null) return noAuthority

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
        const managerCodes = managersByEmployee.get(membership.employeeCode) ?? new Set()

        managerCodes.add(membership.managerEmployeeCode)
        managersByEmployee.set(membership.employeeCode, managerCodes)
      }
    }

    const directManager = managersByEmployee.get(targetCode)?.has(actorCode) ?? false

    const targetDepartments = departmentsByEmployee.get(targetCode) ?? new Set<string>()

    const departmentManager = departmentRows.some(
      (department) =>
        targetDepartments.has(department.code) && department.managerEmployeeCode === actorCode,
    )

    const managementChain = isInManagementChain({
      actorCode,
      targetCode,
      managersByEmployee,
    })

    return { directManager, departmentManager, managementChain }
  } catch (error) {
    return error instanceof Error ? error : new Error("failed to resolve organization authority")
  }
}
