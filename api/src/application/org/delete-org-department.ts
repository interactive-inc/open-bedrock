import { canManageOrg } from "@/domain/org/can-manage-org"
import type { Context } from "@/env"
import { OrgDepartmentRepository } from "@/infrastructure/org/org-department-repository"

export type Command = {
  viewerRole: string
  code: string
}

export type OrgForbidden = { reason: "forbidden" }

export type DepartmentNotFound = { reason: "department_not_found" }

export type DepartmentInUse = { reason: "department_in_use" }

export type Deleted = { reason: "deleted" }

/**
 * 権限を確認し、子ノードと所属メンバーを持たない部署ノードを削除する。
 * 子や所属が残っている場合はデータを孤立させないため拒否する。
 */
export class DeleteOrgDepartment {
  constructor(private readonly c: Context) {}

  async run(
    command: Command,
  ): Promise<Deleted | OrgForbidden | DepartmentNotFound | DepartmentInUse | Error> {
    const departmentRepository = new OrgDepartmentRepository(this.c)

    if (canManageOrg(command.viewerRole) === false) {
      return { reason: "forbidden" }
    }

    const current = await departmentRepository.findByCode(command.code)

    if (current instanceof Error) {
      return current
    }

    if (current === null) {
      return { reason: "department_not_found" }
    }

    const inUse = await this.isInUse(command.code)

    if (inUse instanceof Error) {
      return inUse
    }

    if (inUse === true) {
      return { reason: "department_in_use" }
    }

    const deleted = await departmentRepository.delete(command.code)

    if (deleted instanceof Error) {
      return deleted
    }

    return { reason: "deleted" }
  }

  private async isInUse(code: string): Promise<boolean | Error> {
    const departmentRepository = new OrgDepartmentRepository(this.c)

    const hasChildren = await departmentRepository.hasChildren(code)

    if (hasChildren instanceof Error) {
      return hasChildren
    }

    if (hasChildren === true) {
      return true
    }

    return await departmentRepository.hasMembers(code)
  }
}
