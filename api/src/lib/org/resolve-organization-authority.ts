import type { Context } from "@/env"
import { employees, orgDepartments, orgMemberships } from "@/schema"
import { inArray } from "drizzle-orm"
import { EmployeeLifecycleRepository } from "@/contexts/company/infrastructure/employee-lifecycle/employee-lifecycle-repository"
import { isInManagementChain } from "@/lib/org/is-in-management-chain"
import type { OrganizationAuthority } from "@/lib/org/organization-authority"
import { resolveLifecycleOrganizationAuthority } from "@/lib/org/resolve-lifecycle-organization-authority"

const noAuthority: OrganizationAuthority = {
  directManager: false,
  departmentManager: false,
  managementChain: false,
}

/**
 * 組織図上で actor が target に対して持つ管理関係を解決する。
 * IAM permission は「操作能力」、本関数は「対象範囲」だけを扱う。
 */
export async function resolveOrganizationAuthority(
  c: Context,
  actorEmployeeId: number,
  targetEmployeeId: number,
): Promise<OrganizationAuthority | Error> {
  const migrationStatus = await new EmployeeLifecycleRepository(c).migrationStatus()
  if (migrationStatus instanceof Error) return migrationStatus
  if (migrationStatus === "verified") {
    return resolveLifecycleOrganizationAuthority(c, actorEmployeeId, targetEmployeeId)
  }

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
