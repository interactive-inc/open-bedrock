import type { Context } from "@/env"
import { loadCurrentOrganizationReadModel } from "@/contexts/company/infrastructure/organization/current-organization-read-model"

export type CurrentOrganizationAssignment = {
  departmentCode: string
  position: string | null
  managerEmployeeCode: string | null
  assignmentType: "primary" | "concurrent"
}

export type CurrentOrganizationEmployee = {
  id: number
  code: string
  name: string
  status: "active" | "leave"
  position: string | null
  primaryDepartmentCode: string | null
  managerEmployeeCode: string | null
  departmentCodes: ReadonlyArray<string>
  assignments: ReadonlyArray<CurrentOrganizationAssignment>
}

export type CurrentOrganizationDepartment = {
  code: string
  departmentId: number
  name: string
  parentCode: string | null
  order: number
}

export type CurrentOrganizationReadModel = {
  source: "lifecycle"
  asOf: string | null
  departments: ReadonlyArray<CurrentOrganizationDepartment>
  employeesByCode: ReadonlyMap<string, CurrentOrganizationEmployee>
  managerByDepartmentCode: ReadonlyMap<string, string>
}

/** 現在有効なCompany Organization投影を読み込む。 */
export async function loadCurrentOrganization(
  c: Context,
): Promise<CurrentOrganizationReadModel | Error> {
  return loadCurrentOrganizationReadModel(c)
}
