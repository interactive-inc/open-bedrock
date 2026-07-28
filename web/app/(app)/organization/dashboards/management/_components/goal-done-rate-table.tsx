import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { toPercentLabel } from "@/app/(app)/organization/dashboards/management/_lib/to-percent-label"
import type { GoalDoneRate } from "@/app/(app)/organization/dashboards/management/_lib/management-dashboard-types"

type Props = {
  rows: ReadonlyArray<GoalDoneRate>
}

/** 期間別の目標達成（done）率を表で並べる。 */
export function GoalDoneRateTable(props: Props) {
  if (props.rows.length === 0) {
    return <p className="text-sm text-muted-foreground">目標がありません。</p>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>期間</TableHead>
          <TableHead className="text-right">達成/総数</TableHead>
          <TableHead className="text-right">達成率</TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        {props.rows.map((row) => (
          <TableRow key={row.period}>
            <TableCell>{row.period}</TableCell>
            <TableCell className="text-right tabular-nums">
              {row.done}/{row.total}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {toPercentLabel(row.done_rate)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
