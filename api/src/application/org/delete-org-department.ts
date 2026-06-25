import { canManageOrg } from "@/lib/org/can-manage-org"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { OrgDepartmentRepository } from "@/infrastructure/org/org-department-repository"

export type Command = {
  viewerRole: string
  code: string
}

export type Deleted = { reason: "deleted" }

/**
 * 権限を確認し、子ノードと所属メンバーを持たない部署ノードを削除する。
 * 子や所属が残っている場合はデータを孤立させないため拒否する。
 * チェックと削除は D1 batch でアトミックに行い TOCTOU を防ぐ。
 */
export class DeleteOrgDepartment {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Deleted | ApplicationError> {
    const departmentRepository = new OrgDepartmentRepository(this.c)

    if (canManageOrg(command.viewerRole) === false) {
      return new ForbiddenError("cannot manage org", "forbidden")
    }

    const current = await departmentRepository.findByCode(command.code)

    if (current instanceof Error) {
      return new UnexpectedError("failed to find department", { cause: current })
    }

    if (current === null) {
      return new NotFoundError("department not found", "department_not_found")
    }

    const deleted = await departmentRepository.delete(command.code)

    if (deleted instanceof Error) {
      return new UnexpectedError("failed to delete department", { cause: deleted })
    }

    if (deleted === null) {
      return new ConflictError("department has children or members", "department_in_use")
    }

    return { reason: "deleted" }
  }
}
