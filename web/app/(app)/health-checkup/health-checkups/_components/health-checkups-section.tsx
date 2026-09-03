import { HealthCheckupsTable } from "@/app/(app)/health-checkup/health-checkups/_components/health-checkups-table"
import { FetchError } from "@/components/fetch-error"
import { listHealthCheckups } from "@/lib/api/list-health-checkups"

type Props = {
  fiscalYear: number | undefined
}

/** 健診実施記録一覧セクション。read:all を持つ閲覧者向けに全社の実施状況を取得する。 */
export async function HealthCheckupsSection(props: Props) {
  const records = await listHealthCheckups({ fiscalYear: props.fiscalYear })

  if (records instanceof Error) {
    return <FetchError message="健診実施記録の取得に失敗しました" />
  }

  return <HealthCheckupsTable rows={records} />
}
