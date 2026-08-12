import { UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { OrgDepartment } from "@/contexts/company/domain/organization/org-department.entity"
import type { Context } from "@/env"
import { OrgDepartmentRepository } from "@/contexts/company/infrastructure/organization/org-department-repository"

/**
 * 組織図の部署ノードを表示順で一覧する。
 */
export class ListOrgDepartments {
  constructor(private readonly c: Context) {}

  async run(): Promise<ReadonlyArray<OrgDepartment> | ApplicationError> {
    const departmentRepository = new OrgDepartmentRepository(this.c)

    const departments = await departmentRepository.findAll()

    if (departments instanceof Error) {
      return new UnexpectedError("failed to find departments", { cause: departments })
    }

    return departments
  }
}
