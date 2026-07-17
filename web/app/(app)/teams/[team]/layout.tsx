import { notFound } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { getEmployeeByCode } from "@/lib/api/get-employee-by-code"
import { getOrgDepartment } from "@/lib/api/get-org-department"
import { getOrgTree } from "@/lib/api/get-org-tree"
import { findOrgTreeNode } from "@/lib/org/find-org-tree-node"

type Props = {
  children: React.ReactNode
  params: Promise<{ team: string }>
}

// 部署ハブの共通レイアウト。部署名・コード・責任者のヘッダとタブ（概要 / メンバー）を共有する。
export default async function DepartmentLayout(props: Props) {
  const params = await props.params

  const [department, tree] = await Promise.all([getOrgDepartment(params.team), getOrgTree()])

  if (department instanceof Error) {
    notFound()
  }

  const node = tree instanceof Error ? null : findOrgTreeNode(tree, params.team)

  const managerCode = department.manager_employee_code

  const manager = managerCode === null ? null : await getEmployeeByCode(managerCode)

  const managerName = manager === null || manager instanceof Error ? null : manager.name

  const description = [
    `コード: ${department.code}`,
    managerName === null ? "責任者: 未設定" : `責任者: ${managerName}`,
  ].join(" / ")

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={node === null ? params.team : node.name} description={description} />

      {props.children}
    </div>
  )
}
