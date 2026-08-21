import type { Context } from "@/env"
import { readCanonicalOrganizationState } from "@/contexts/company/infrastructure/organization/read-canonical-organization-state.repository"
import { toStorageEmployeeId } from "@/contexts/company/infrastructure/workforce/to-storage-employee-id.repository"

export type Props = {
  c: Context
  departmentCode: string
}

/**
 * 指定部署に所属(主配属・兼務とも)する従業員 id をcanonical Company snapshotから解決する。
 * 下位部署は含まない(部署スコープの既存規約)。部署が存在しない場合も空配列を返す。
 */
export async function listDepartmentEmployeeIds(props: Props): Promise<Array<number> | Error> {
  const snapshot = await readCanonicalOrganizationState(props.c)
  if (snapshot instanceof Error) return snapshot
  const unitIds = new Set(
    snapshot.organization.units
      .filter((unit) => unit.code === props.departmentCode)
      .map((unit) => unit.organizationUnitId),
  )
  if (unitIds.size === 0) return []

  const employeeIds: number[] = []
  for (const employee of snapshot.employees) {
    if (
      employee.employmentId === null ||
      (employee.status !== "ACTIVE" && employee.status !== "ON_LEAVE")
    ) {
      continue
    }
    const assignments = [
      ...(employee.primaryAssignment === null ? [] : [employee.primaryAssignment]),
      ...employee.concurrentAssignments,
    ]
    if (!assignments.some((assignment) => unitIds.has(assignment.organizationUnitId))) continue

    const storageId = toStorageEmployeeId(employee.employeeId)
    if (storageId instanceof Error) return storageId
    employeeIds.push(storageId)
  }
  return employeeIds.toSorted((left, right) => left - right)
}
