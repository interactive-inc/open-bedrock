import type { OrgDepartment } from "@/domain/org/org-department.entity"
import type { Context } from "@/env"
import { OrgDepartmentRepository } from "@/infrastructure/org/org-department-repository"

export type Command = {
  code: string
}

export type DepartmentNotFound = { reason: "department_not_found" }

/**
 * 組織図の部署ノードを1件取得する。
 */
export class GetOrgDepartment {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<OrgDepartment | DepartmentNotFound | Error> {
    const departmentRepository = new OrgDepartmentRepository(this.c)

    const department = await departmentRepository.findByCode(command.code)

    if (department instanceof Error) {
      return department
    }

    if (department === null) {
      return { reason: "department_not_found" }
    }

    return department
  }
}
