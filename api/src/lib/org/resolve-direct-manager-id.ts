import type { Context } from "@/env"
import { employees, orgAssignmentPeriodVersions, orgMemberships } from "@/schema"
import { and, desc, eq } from "drizzle-orm"
import { EmployeeLifecycleRepository } from "@/infrastructure/employee-lifecycle/employee-lifecycle-repository"

/**
 * 対象社員の直属上長の employee ID を解決する。
 *
 * lifecycle migration が "verified" の場合は orgAssignmentPeriodVersions（正本）から、
 * それ以外は orgMemberships（レガシー）から解決する。
 *
 * 社員コードが未設定、上長が未設定、上長に対応する社員が見つからない場合は null を返す。
 */
export async function resolveDirectManagerId(
  c: Context,
  targetEmployeeId: number,
): Promise<number | null | Error> {
  try {
    const migrationStatus = await new EmployeeLifecycleRepository(c).migrationStatus()

    if (migrationStatus instanceof Error) {
      return migrationStatus
    }

    if (migrationStatus === "verified") {
      return resolveViaLifecycle(c, targetEmployeeId)
    }

    return resolveViaLegacy(c, targetEmployeeId)
  } catch (error) {
    return error instanceof Error ? error : new Error("failed to resolve direct manager")
  }
}

/**
 * lifecycle 正本（orgAssignmentPeriodVersions）から上長を解決する。
 * managerEmployeeId が直接 employee ID で格納されている。
 */
async function resolveViaLifecycle(c: Context, targetEmployeeId: number): Promise<number | null> {
  const rows = await c.var.database
    .select({ managerEmployeeId: orgAssignmentPeriodVersions.managerEmployeeId })
    .from(orgAssignmentPeriodVersions)
    .where(
      and(
        eq(orgAssignmentPeriodVersions.employeeId, targetEmployeeId),
        eq(orgAssignmentPeriodVersions.isVoid, false),
        eq(orgAssignmentPeriodVersions.assignmentType, "primary"),
      ),
    )
    .orderBy(desc(orgAssignmentPeriodVersions.revision))
    .limit(1)

  return rows.at(0)?.managerEmployeeId ?? null
}

/**
 * レガシー（orgMemberships）から上長を解決する。
 * managerEmployeeCode をコードから employee ID に変換する。
 */
async function resolveViaLegacy(c: Context, targetEmployeeId: number): Promise<number | null> {
  // 対象社員のコードを取得
  const employeeRows = await c.var.database
    .select({ code: employees.code })
    .from(employees)
    .where(eq(employees.id, targetEmployeeId))
    .limit(1)

  const targetCode = employeeRows.at(0)?.code

  if (targetCode === undefined || targetCode === null) {
    return null
  }

  // orgMemberships から上長コードを取得
  const membershipRows = await c.var.database
    .select({ managerEmployeeCode: orgMemberships.managerEmployeeCode })
    .from(orgMemberships)
    .where(eq(orgMemberships.employeeCode, targetCode))
    .limit(1)

  const managerCode = membershipRows.at(0)?.managerEmployeeCode

  if (managerCode === undefined || managerCode === null) {
    return null
  }

  // 上長コードから employee ID を解決
  const managerRows = await c.var.database
    .select({ id: employees.id })
    .from(employees)
    .where(eq(employees.code, managerCode))
    .limit(1)

  return managerRows.at(0)?.id ?? null
}

/**
 * 対象社員の部門長（department manager）の employee ID を解決する。
 * orgMemberships → orgDepartments → employees の経路で解決する。
 * 見つからない場合は null を返す。
 */
export async function resolveDepartmentManagerId(
  c: Context,
  targetEmployeeId: number,
): Promise<number | null | Error> {
  try {
    const migrationStatus = await new EmployeeLifecycleRepository(c).migrationStatus()

    if (migrationStatus instanceof Error) {
      return migrationStatus
    }

    if (migrationStatus === "verified") {
      return resolveDeptManagerViaLifecycle(c, targetEmployeeId)
    }

    return resolveDeptManagerViaLegacy(c, targetEmployeeId)
  } catch (error) {
    return error instanceof Error ? error : new Error("failed to resolve department manager")
  }
}

/** lifecycle 正本から部門責任者を解決する。 */
async function resolveDeptManagerViaLifecycle(
  c: Context,
  targetEmployeeId: number,
): Promise<number | null> {
  const { orgResponsibilityPeriodVersions } = await import("@/schema")

  // 対象社員の所属部門を取得
  const assignmentRows = await c.var.database
    .select({ departmentCode: orgAssignmentPeriodVersions.departmentCode })
    .from(orgAssignmentPeriodVersions)
    .where(
      and(
        eq(orgAssignmentPeriodVersions.employeeId, targetEmployeeId),
        eq(orgAssignmentPeriodVersions.isVoid, false),
        eq(orgAssignmentPeriodVersions.assignmentType, "primary"),
      ),
    )
    .orderBy(desc(orgAssignmentPeriodVersions.revision))
    .limit(1)

  const deptCode = assignmentRows.at(0)?.departmentCode

  if (deptCode === undefined) {
    return null
  }

  // 部門責任者を取得
  const respRows = await c.var.database
    .select({ employeeId: orgResponsibilityPeriodVersions.employeeId })
    .from(orgResponsibilityPeriodVersions)
    .where(
      and(
        eq(orgResponsibilityPeriodVersions.departmentCode, deptCode),
        eq(orgResponsibilityPeriodVersions.isVoid, false),
      ),
    )
    .orderBy(desc(orgResponsibilityPeriodVersions.revision))
    .limit(1)

  return respRows.at(0)?.employeeId ?? null
}

/** レガシーから部門長を解決する。 */
async function resolveDeptManagerViaLegacy(
  c: Context,
  targetEmployeeId: number,
): Promise<number | null> {
  const { orgDepartments } = await import("@/schema")

  // 対象社員のコードを取得
  const employeeRows = await c.var.database
    .select({ code: employees.code })
    .from(employees)
    .where(eq(employees.id, targetEmployeeId))
    .limit(1)

  const targetCode = employeeRows.at(0)?.code

  if (targetCode === undefined || targetCode === null) {
    return null
  }

  // orgMemberships から所属部門コードを取得
  const membershipRows = await c.var.database
    .select({ departmentCode: orgMemberships.departmentCode })
    .from(orgMemberships)
    .where(eq(orgMemberships.employeeCode, targetCode))
    .limit(1)

  const deptCode = membershipRows.at(0)?.departmentCode

  if (deptCode === undefined) {
    return null
  }

  // orgDepartments から部門長コードを取得
  const deptRows = await c.var.database
    .select({ managerEmployeeCode: orgDepartments.managerEmployeeCode })
    .from(orgDepartments)
    .where(eq(orgDepartments.code, deptCode))
    .limit(1)

  const deptManagerCode = deptRows.at(0)?.managerEmployeeCode

  if (deptManagerCode === undefined || deptManagerCode === null) {
    return null
  }

  // 部門長コードから employee ID を解決
  const managerRows = await c.var.database
    .select({ id: employees.id })
    .from(employees)
    .where(eq(employees.code, deptManagerCode))
    .limit(1)

  return managerRows.at(0)?.id ?? null
}
