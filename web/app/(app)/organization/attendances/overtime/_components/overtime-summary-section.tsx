import { EmptyState } from "@/components/empty-state"
import { FetchError } from "@/components/fetch-error"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getOvertimeSummary } from "@/lib/api/get-overtime-summary"
import type { OvertimeScope } from "@/lib/api/types/overtime-types"
import { toDurationLabel } from "@/app/(app)/my/attendances/_lib/to-duration-label"

type Props = {
  month: string | null
  scope: OvertimeScope | null
}

// 時間外の参考集計をサーバ側 fetch して描画する非同期 RSC。
// 集計値は法定判定ではない参考値であることを note として明示する。
export async function OvertimeSummarySection(props: Props) {
  const summary = await getOvertimeSummary({ month: props.month, scope: props.scope })

  if (summary instanceof Error) {
    return <FetchError message="時間外の集計取得に失敗しました（権限が必要な場合があります）" />
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
        <p>
          対象月: {summary.month} / 営業日: {summary.business_days} 日 / 所定:{" "}
          {toDurationLabel(summary.daily_regular_minutes)} / 日
        </p>

        <p className="mt-2">{summary.note}</p>
      </div>

      {summary.entries.length === 0 ? (
        <EmptyState title="対象の勤怠がありません" />
      ) : (
        <div className="overflow-x-auto">
          <Table aria-label="時間外の参考集計">
            <TableHeader>
              <TableRow>
                <TableHead>従業員 ID</TableHead>

                <TableHead className="text-right">勤務日数</TableHead>

                <TableHead className="text-right">総労働時間</TableHead>

                <TableHead className="text-right">時間外（参考）</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {summary.entries.map((entry) => (
                <TableRow key={entry.employee_id}>
                  <TableCell className="font-medium">{entry.employee_id}</TableCell>

                  <TableCell className="text-right">{entry.work_days}</TableCell>

                  <TableCell className="text-right">
                    {toDurationLabel(entry.total_work_minutes)}
                  </TableCell>

                  <TableCell className="text-right">
                    {toDurationLabel(entry.overtime_minutes)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
