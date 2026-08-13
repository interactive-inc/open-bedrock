import type { Context } from "@/env"
import { and, eq, isNull } from "drizzle-orm"
import { EmployeeLifecycleRepository } from "@/contexts/company/infrastructure/employee-lifecycle/employee-lifecycle-repository"
import { employees } from "@/contexts/company/infrastructure/schema/employee"
import {
  orgDepartments,
  orgMemberships,
} from "@/contexts/company/infrastructure/schema/organization"

/**
 * lifecycle 日付フィルタ。
 * starts_on <= asOf < ends_on (ends_on が null なら上限なし)。
 */
function contains(row: { starts_on: string; ends_on: string | null }, asOf: string): boolean {
  return row.starts_on <= asOf && (row.ends_on === null || asOf < row.ends_on)
}

/**
 * 対象社員の直属上長の employee ID を解決する。
 *
 * lifecycle migration が "verified" の場合は orgAssignmentPeriodVersions（正本）から、
 * それ以外は orgMemberships（レガシー）から解決する。
 *
 * 社員コードが未設定、上長が未設定、上長に対応する社員が見つからない場合は null を返す。
 *
 * @param asOf lifecycle パスで有効な所属を判定する基準日（YYYY-MM-DD）。省略時は全件から最新を返す（後方互換）。
 */
export async function resolveDirectManagerId(
  c: Context,
  targetEmployeeId: number,
  asOf?: string,
): Promise<number | null | Error> {
  try {
    const migrationStatus = await new EmployeeLifecycleRepository(c).migrationStatus()

    if (migrationStatus instanceof Error) {
      return migrationStatus
    }

    if (migrationStatus === "verified") {
      return resolveViaLifecycle(c, targetEmployeeId, asOf)
    }

    return resolveViaLegacy(c, targetEmployeeId)
  } catch (error) {
    return error instanceof Error ? error : new Error("failed to resolve direct manager")
  }
}

/**
 * lifecycle 正本（orgAssignmentPeriodVersions）から上長を解決する。
 *
 * 正規パターン:
 *   1. MAX(revision) per period_id で最新版のみ取得
 *   2. is_void = 0 で論理削除を除外
 *   3. contains(row, asOf) で基準日に有効な期間のみ残す
 */
async function resolveViaLifecycle(
  c: Context,
  targetEmployeeId: number,
  asOf?: string,
): Promise<number | null> {
  const rows = await c.env.DB.prepare(
    `SELECT current.manager_employee_id, current.starts_on, current.ends_on
     FROM employee_org_assignment_period_versions AS current
     WHERE current.employee_id = ?1
       AND current.assignment_type = 'primary'
       AND current.revision = (
         SELECT MAX(candidate.revision)
         FROM employee_org_assignment_period_versions AS candidate
         WHERE candidate.period_id = current.period_id
       )
       AND current.is_void = 0
       AND EXISTS (
         SELECT 1 FROM org_departments
         WHERE code = current.department_code AND archived_at IS NULL
       )`,
  )
    .bind(targetEmployeeId)
    .all<{ manager_employee_id: number | null; starts_on: string; ends_on: string | null }>()

  if (asOf !== undefined) {
    const active = rows.results.find((row) => contains(row, asOf))
    return active?.manager_employee_id ?? null
  }

  // asOf 未指定（後方互換）: 最新のレコードをそのまま返す
  return rows.results.at(0)?.manager_employee_id ?? null
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
 *
 * lifecycle migration が "verified" の場合は正本テーブルから、
 * それ以外は orgMemberships → orgDepartments → employees の経路で解決する。
 * 見つからない場合は null を返す。
 *
 * @param asOf lifecycle パスで有効な所属を判定する基準日（YYYY-MM-DD）。
 */
export async function resolveDepartmentManagerId(
  c: Context,
  targetEmployeeId: number,
  asOf?: string,
): Promise<number | null | Error> {
  try {
    const migrationStatus = await new EmployeeLifecycleRepository(c).migrationStatus()

    if (migrationStatus instanceof Error) {
      return migrationStatus
    }

    if (migrationStatus === "verified") {
      return resolveDeptManagerViaLifecycle(c, targetEmployeeId, asOf)
    }

    return resolveDeptManagerViaLegacy(c, targetEmployeeId)
  } catch (error) {
    return error instanceof Error ? error : new Error("failed to resolve department manager")
  }
}

/**
 * lifecycle 正本から部門責任者を解決する。
 *
 * 1. 対象社員の現在有効な所属（assignment）から部門コードを取得
 * 2. その部門の現在有効な責任者（responsibility）を取得
 */
async function resolveDeptManagerViaLifecycle(
  c: Context,
  targetEmployeeId: number,
  asOf?: string,
): Promise<number | null> {
  // 対象社員の所属部門を取得（MAX(revision) + is_void + date filter + archived 除外）
  const assignmentRows = await c.env.DB.prepare(
    `SELECT current.department_code, current.starts_on, current.ends_on
     FROM employee_org_assignment_period_versions AS current
     WHERE current.employee_id = ?1
       AND current.assignment_type = 'primary'
       AND current.revision = (
         SELECT MAX(candidate.revision)
         FROM employee_org_assignment_period_versions AS candidate
         WHERE candidate.period_id = current.period_id
       )
       AND current.is_void = 0
       AND EXISTS (
         SELECT 1 FROM org_departments
         WHERE code = current.department_code AND archived_at IS NULL
       )`,
  )
    .bind(targetEmployeeId)
    .all<{ department_code: string; starts_on: string; ends_on: string | null }>()

  let deptCode: string | undefined

  if (asOf !== undefined) {
    deptCode = assignmentRows.results.find((row) => contains(row, asOf))?.department_code
  } else {
    deptCode = assignmentRows.results.at(0)?.department_code
  }

  if (deptCode === undefined) {
    return null
  }

  // 部門責任者を取得（MAX(revision) + is_void + date filter）
  const respRows = await c.env.DB.prepare(
    `SELECT current.employee_id, current.starts_on, current.ends_on
     FROM employee_org_responsibility_period_versions AS current
     WHERE current.department_code = ?1
       AND current.revision = (
         SELECT MAX(candidate.revision)
         FROM employee_org_responsibility_period_versions AS candidate
         WHERE candidate.period_id = current.period_id
       )
       AND current.is_void = 0`,
  )
    .bind(deptCode)
    .all<{ employee_id: number; starts_on: string; ends_on: string | null }>()

  if (asOf !== undefined) {
    return respRows.results.find((row) => contains(row, asOf))?.employee_id ?? null
  }

  return respRows.results.at(0)?.employee_id ?? null
}

/** レガシーから部門長を解決する。 */
async function resolveDeptManagerViaLegacy(
  c: Context,
  targetEmployeeId: number,
): Promise<number | null> {
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

  // orgDepartments から部門長コードを取得（archived 部門を除外）
  const deptRows = await c.var.database
    .select({ managerEmployeeCode: orgDepartments.managerEmployeeCode })
    .from(orgDepartments)
    .where(and(eq(orgDepartments.code, deptCode), isNull(orgDepartments.archivedAt)))
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
