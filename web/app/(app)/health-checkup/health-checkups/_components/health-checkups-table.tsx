import { EmptyState } from "@/components/empty-state"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatDate } from "@/lib/format-date"
import type { HealthCheckupResponse } from "@/lib/api/types/health-checkup-types"
import { Button } from "@/components/ui/button"

type Props = {
  rows: ReadonlyArray<HealthCheckupResponse>
}

const KIND_LABELS: Record<string, string> = {
  regular: "定期健診",
  stress_check: "ストレスチェック",
}

const STATUS_LABELS: Record<string, string> = {
  scheduled: "予定",
  completed: "実施済み",
  declined: "辞退",
}

/** 健診実施記録テーブル。結果は一切表示せず、種別・年度・実施日・受診状態のみを出す。 */
export function HealthCheckupsTable(props: Props) {
  if (props.rows.length === 0) {
    return <EmptyState title="実施記録がありません" />
  }

  return (
    <div className="overflow-x-auto">
      <Table aria-label={`健診実施記録 ${props.rows.length} 件`}>
        <TableHeader>
          <TableRow>
            <TableHead>従業員 ID</TableHead>
            <TableHead>年度</TableHead>
            <TableHead>種別</TableHead>
            <TableHead>実施日</TableHead>
            <TableHead>受診状態</TableHead>
            <TableHead className="hidden md:table-cell">備考</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {props.rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>{row.employee_id}</TableCell>

              <TableCell>{row.fiscal_year}</TableCell>

              <TableCell>{KIND_LABELS[row.checkup_kind] ?? row.checkup_kind}</TableCell>

              <TableCell>
                {row.conducted_on !== null ? formatDate(row.conducted_on) : "—"}
              </TableCell>

              <TableCell>
                <Button type="button" variant="secondary" size="sm">
                  {STATUS_LABELS[row.status] ?? row.status}
                </Button>
              </TableCell>

              <TableCell className="hidden md:table-cell">{row.note ?? "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
