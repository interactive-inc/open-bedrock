import { canManageOrg } from "@/lib/org/can-manage-org"
import { OrgDepartment } from "@/domain/org/org-department.entity"
import type { Context } from "@/env"
import { OrgDepartmentRepository } from "@/infrastructure/org/org-department-repository"
import { UniqueConstraintError } from "@/infrastructure/shared/unique-constraint-error"

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

    const department = OrgDepartment.create({
      code: command.department.code,
      departmentId: command.department.departmentId,
      parentCode: command.department.parentCode,
      managerEmployeeCode: command.department.managerEmployeeCode,
      order: command.department.order,
    })

    const created = await departmentRepository.create(department)

    // findByCode と insert の間に並行リクエストが挿入されると UNIQUE 制約違反になる。
    // リポジトリが UniqueConstraintError として返すので、重複として扱う（TOCTOU 競合対策）。
    if (created instanceof UniqueConstraintError) {
      return { reason: "department_code_conflict" }
    }

    // ensureParentExists と insert の間に親が削除されると INSERT 0 行になる。
    // リポジトリが { reason: "parent_not_found" } を返すのでそのまま伝播する。
    if (!(created instanceof Error) && "reason" in created) {
      return created
    }

    return created
  }
}
