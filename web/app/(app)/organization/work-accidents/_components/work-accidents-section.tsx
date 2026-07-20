import { WorkAccidentsTable } from "@/app/(app)/organization/work-accidents/_components/work-accidents-table"
import { FetchError } from "@/components/fetch-error"
import { listWorkAccidents } from "@/lib/api/list-work-accidents"

type Props = {
  status: "reported" | "closed" | undefined
  canManage: boolean
}

/** 労災・事故の発生記録一覧セクション。read:all を持つ閲覧者向けに全社の記録を取得する。 */
export async function WorkAccidentsSection(props: Props) {
  const records = await listWorkAccidents({ status: props.status })

  if (records instanceof Error) {
    return <FetchError message="労災・事故記録の取得に失敗しました" />
  }

  return <WorkAccidentsTable rows={records} canManage={props.canManage} />
}
