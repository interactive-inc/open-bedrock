import type { Context } from "@/env"
import { employees, orgDepartments, orgMemberships } from "@/schema"
import { inArray } from "drizzle-orm"

export type OrganizationAuthority = {
  directManager: boolean
  departmentManager: boolean
  managementChain: boolean
}

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

    if (actorCode === undefined || targetCode === undefined) {
      return noAuthority
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

/** actor が管理できる社員IDを返す。受信箱の絞り込みに使う。 */
export async function listManagedEmployeeIds(
  c: Context,
  actorEmployeeId: number,
): Promise<ReadonlyArray<number> | Error> {
  try {
    const employeeRows = await c.var.database
      .select({ id: employees.id, code: employees.code })
      .from(employees)

    const actorCode = employeeRows.find((employee) => employee.id === actorEmployeeId)?.code

    if (actorCode === undefined) {
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

function isInManagementChain(props: {
  actorCode: string
  targetCode: string
  managersByEmployee: ReadonlyMap<string, ReadonlySet<string>>
}): boolean {
  const pending = [...(props.managersByEmployee.get(props.targetCode) ?? [])]
  const visited = new Set<string>([props.targetCode])

  while (pending.length > 0) {
    const managerCode = pending.shift()

    if (managerCode === undefined || visited.has(managerCode)) {
      continue
    }

    if (managerCode === props.actorCode) {
      return true
    }

    visited.add(managerCode)
    pending.push(...(props.managersByEmployee.get(managerCode) ?? []))
  }

  return false
}
