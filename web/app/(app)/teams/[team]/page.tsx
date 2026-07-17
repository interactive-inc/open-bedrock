import { redirect } from "next/navigation"

type Props = {
  params: Promise<{ team: string }>
}

/**
 * 部署ハブの入口。概要ページは持たず、メンバー一覧へ直行する
 */
export default async function DepartmentPage(props: Props) {
  const params = await props.params

  redirect(`/teams/${params.team}/members`)
}
