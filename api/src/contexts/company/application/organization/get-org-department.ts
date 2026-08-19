import { NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { OrgDepartment } from "@/contexts/company/domain/organization/org-department.entity"
import type { Context } from "@/env"
import { OrgDepartmentRepository } from "@/contexts/company/infrastructure/organization/org-department-repository"

export type Command = {
  code: string
}

/**
 * 組織図の部署ノードを1件取得する。
 */
export class GetOrgDepartment {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<OrgDepartment | ApplicationError> {
    const departmentRepository = new OrgDepartmentRepository(this.c)

    const department = await departmentRepository.findByCode(command.code)

    if (department instanceof Error) {
      return new UnexpectedError("failed to find department", { cause: department })
    }

    if (department === null) {
      return new NotFoundError("department not found", "department_not_found")
    }

    return department
  }
}
