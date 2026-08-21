import type { Department } from "@/contexts/company/domain/definitions/department.definition"
import type { Session } from "@/lib/auth/session"
import { ConflictError, ForbiddenError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { DepartmentRepository } from "@/contexts/administration/infrastructure/organization/department.repository"
import { UniqueConstraintError } from "@/lib/d1/unique-constraint-error"

export type Command = {
  session: Session
  name: string
}

/**
 * 権限と重複名を確認し、新しい部署をマスタに登録する。
 * 組織図への配置（部署ノードの作成）は含まない。
 */
export class CreateDepartment {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Department | ApplicationError> {
    if (command.session.hasPermission("org:manage") === false) {
      return new ForbiddenError("cannot manage departments", "forbidden")
    }

    const repository = new DepartmentRepository(this.c)

    const created = await repository.create(command.name)

    if (created instanceof UniqueConstraintError) {
      return new ConflictError("department name already exists", "department_name_conflict")
    }

    if (created instanceof Error) {
      return new UnexpectedError("failed to create department", {
        cause: created,
      })
    }

    return created
  }
}
