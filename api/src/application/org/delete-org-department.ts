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
 * チェックと削除は D1 batch でアトミックに行い TOCTOU を防ぐ。
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

    const deleted = await departmentRepository.delete(command.code)

    if (deleted instanceof Error) {
      return deleted
    }

    if (deleted === null) {
      return { reason: "department_in_use" }
    }

    return { reason: "deleted" }
  }
}
