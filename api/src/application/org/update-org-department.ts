import { canManageOrg } from "@/domain/org/can-manage-org"
import type { OrgDepartment } from "@/domain/org/org-department"
import type { Context } from "@/env"
import { OrgDepartmentRepository } from "@/infrastructure/org/org-department-repository"

export type Command = {
  viewerRole: string
  code: string
  parentCode: string | null
  managerEmployeeCode: string | null
  order: number
}

export type OrgForbidden = { reason: "forbidden" }

export type DepartmentNotFound = { reason: "department_not_found" }

export type ParentNotFound = { reason: "parent_not_found" }

export type InvalidParent = { reason: "invalid_parent" }

/**
 * 権限を確認し、部署ノードの親・責任者・表示順を変更する。自分自身を親にすることは拒否する。
 */
export class UpdateOrgDepartment {
  constructor(private readonly c: Context) {}

  async run(
    command: Command,
  ): Promise<
    OrgDepartment | OrgForbidden | DepartmentNotFound | ParentNotFound | InvalidParent | Error
  > {
    const departmentRepository = new OrgDepartmentRepository(this.c)

    if (canManageOrg(command.viewerRole) === false) {
      return { reason: "forbidden" }
    }

    if (command.parentCode === command.code) {
      return { reason: "invalid_parent" }
    }

    const current = await departmentRepository.findByCode(command.code)

    if (current instanceof Error) {
      return current
    }

    if (current === null) {
      return { reason: "department_not_found" }
    }

    const parentChecked = await this.ensureParentExists(command.parentCode)

    if (parentChecked !== null) {
      return parentChecked
    }

    const updated = current
      .withParent(command.parentCode)
      .updateManager(command.managerEmployeeCode)
      .updateOrder(command.order)

    const saved = await departmentRepository.update(updated)

    if (saved instanceof Error) {
      return saved
    }

    if (saved === null) {
      return { reason: "department_not_found" }
    }

    return saved
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
