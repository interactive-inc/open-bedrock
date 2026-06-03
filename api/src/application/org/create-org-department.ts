import { canManageOrg } from "@/domain/org/can-manage-org"
import { OrgDepartment } from "@/domain/org/org-department"
import type { Context } from "@/env"
import { OrgDepartmentRepository } from "@/infrastructure/org/org-department-repository"

export type Command = {
  viewerRole: string
  department: {
    code: string
    departmentId: number
    parentCode: string | null
    managerEmployeeCode: string | null
    order: number
  }
}

export type OrgForbidden = { reason: "forbidden" }

export type DepartmentCodeConflict = { reason: "department_code_conflict" }

export type ParentNotFound = { reason: "parent_not_found" }

/**
 * 権限・コード重複・親ノードの存在を確認し、新しい部署ノードを作成する。
 */
export class CreateOrgDepartment {
  constructor(private readonly c: Context) {}

  async run(
    command: Command,
  ): Promise<OrgDepartment | OrgForbidden | DepartmentCodeConflict | ParentNotFound | Error> {
    const departmentRepository = new OrgDepartmentRepository(this.c)

    if (canManageOrg(command.viewerRole) === false) {
      return { reason: "forbidden" }
    }

    const existing = await departmentRepository.findByCode(command.department.code)

    if (existing instanceof Error) {
      return existing
    }

    if (existing !== null) {
      return { reason: "department_code_conflict" }
    }

    const parentChecked = await this.ensureParentExists(command.department.parentCode)

    if (parentChecked !== null) {
      return parentChecked
    }

    const department = OrgDepartment.create({
      code: command.department.code,
      departmentId: command.department.departmentId,
      parentCode: command.department.parentCode,
      managerEmployeeCode: command.department.managerEmployeeCode,
      order: command.department.order,
    })

    return await departmentRepository.create(department)
  }

  private async ensureParentExists(
    parentCode: string | null,
  ): Promise<ParentNotFound | Error | null> {
    if (parentCode === null) {
      return null
    }

    const parent = await new OrgDepartmentRepository(this.c).findByCode(parentCode)

    if (parent instanceof Error) {
      return parent
    }

    if (parent === null) {
      return { reason: "parent_not_found" }
    }

    return null
  }
}
