import type { Session } from "@/contexts/company/domain/iam/session"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { OrgDepartment } from "@/contexts/company/domain/organization/org-department.entity"
import type { Context } from "@/env"
import { OrgDepartmentRepository } from "@/contexts/company/infrastructure/organization/org-department-repository"
import { DepartmentRepository } from "@/contexts/company/infrastructure/organization/department-repository"
import { UniqueConstraintError } from "@/lib/d1/unique-constraint-error"

export type Command = {
  session: Session
  department: {
    code: string
    departmentId: number
    parentCode: string | null
    managerEmployeeCode: string | null
    order: number
  }
}

/**
 * 権限・コード重複・親ノードの存在を確認し、新しい部署ノードを作成する。
 */
export class CreateOrgDepartment {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<OrgDepartment | ApplicationError> {
    const departmentRepository = new OrgDepartmentRepository(this.c)

    if (command.session.hasPermission("org:manage") === false) {
      return new ForbiddenError("cannot manage org", "forbidden")
    }

    if (command.department.managerEmployeeCode !== null) {
      return new ConflictError(
        "department responsibility must be changed with a personnel action",
        "lifecycle_action_required",
      )
    }

    const existing = await departmentRepository.findByCode(command.department.code)

    if (existing instanceof Error) {
      return new UnexpectedError("failed to find department", { cause: existing })
    }

    if (existing !== null) {
      return new ConflictError("department code already exists", "department_code_conflict")
    }

    const departmentMaster = await new DepartmentRepository(this.c).findById(
      command.department.departmentId,
    )
    if (departmentMaster instanceof Error) {
      return new UnexpectedError("failed to find department master", { cause: departmentMaster })
    }
    if (departmentMaster === null) {
      return new NotFoundError("department master not found", "department_not_found")
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
      return new ConflictError("department code already exists", "department_code_conflict")
    }

    if (created instanceof Error) {
      return new UnexpectedError("failed to create department", { cause: created })
    }

    // ensureParentExists と insert の間に親が削除されると INSERT 0 行になる。
    // リポジトリが { reason: "parent_not_found" } を返すので NotFoundError に翻訳する。
    if ("reason" in created) {
      return new NotFoundError("parent department not found", "parent_not_found")
    }

    return created
  }
}
