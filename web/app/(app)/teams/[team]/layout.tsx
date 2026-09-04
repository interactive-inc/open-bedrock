import { notFound } from "next/navigation"
import { getOrgDepartment } from "@/lib/api/get-org-department"

type Props = {
  children: React.ReactNode
  params: Promise<{ team: string }>
}

/**
 * 部署ハブの共通レイアウト。存在しない部署コードなら 404 にする。
 * 見出しはサイドバーの label に合わせて各ページが持つため、ここでは検証とラッパのみを提供する。
 */
export default async function DepartmentLayout(props: Props) {
  const params = await props.params

  const department = await getOrgDepartment(params.team)

  if (department instanceof Error) {
    notFound()
  }

  return <div className="flex flex-col gap-8">{props.children}</div>
}
