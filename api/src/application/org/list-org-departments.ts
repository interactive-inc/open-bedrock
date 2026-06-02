import type { OrgDepartment } from "@/domain/org/org-department"
import type { Context } from "@/env"
import { OrgDepartmentRepository } from "@/infrastructure/org/org-department-repository"

/**
 * 組織図の部署ノードを表示順で一覧する。
 */
export class ListOrgDepartments {
  constructor(private readonly c: Context) {}

  async run(): Promise<ReadonlyArray<OrgDepartment> | Error> {
    const departmentRepository = new OrgDepartmentRepository(this.c)

    return await departmentRepository.findAll()
  }
}
