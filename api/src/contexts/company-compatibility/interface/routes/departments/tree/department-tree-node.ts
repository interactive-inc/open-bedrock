import type { OrgDepartment } from "@/contexts/company-compatibility/domain/organization/org-department.entity"

/** 部署ツリーのドメイン内部表現。HTTP のレスポンス形（snake_case）とは分ける。 */
export type DepartmentTreeNode = {
  department: OrgDepartment
  name: string
  memberCount: number
  children: ReadonlyArray<DepartmentTreeNode>
}
