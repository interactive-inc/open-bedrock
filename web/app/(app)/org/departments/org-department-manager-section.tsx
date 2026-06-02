import { OrgDepartmentManagerList } from "@/app/(app)/org/departments/org-department-manager-list"
import { listOrgDepartments } from "@/lib/api/list-org-departments"

// 部署ノード管理セクション（GET /org/departments）。取得失敗時はメッセージを表示する。
export async function OrgDepartmentManagerSection() {
  const departments = await listOrgDepartments()

  if (departments instanceof Error) {
    return <p className="text-sm text-destructive">部署ノードの取得に失敗しました</p>
  }

  return <OrgDepartmentManagerList departments={departments} />
}
