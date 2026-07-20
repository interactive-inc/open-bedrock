import { EmptyState } from "@/components/empty-state"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatDate } from "@/lib/format-datetime"
import type { WorkAccidentResponse } from "@/lib/api/types/work-accident-types"

type Props = {
  rows: ReadonlyArray<WorkAccidentResponse>
  canManage: boolean
}

const SEVERITY_LABELS: Record<string, string> = {
  minor: "軽微",
  serious: "重大",
}

const STATUS_LABELS: Record<string, string> = {
  reported: "報告済み",
  closed: "対応完了",
}

/** 労災・事故の発生記録テーブル。対象者不特定の事故は従業員 ID が空欄になる。 */
export function WorkAccidentsTable(props: Props) {
  if (props.rows.length === 0) {
    return <EmptyState title="発生記録がありません" />
  }

  return (
    <div className="overflow-x-auto">
      <Table aria-label={`労災・事故記録 ${props.rows.length} 件`}>
        <TableHeader>
          <TableRow>
            <TableHead>発生日</TableHead>
            <TableHead>従業員 ID</TableHead>
            <TableHead className="hidden md:table-cell">場所</TableHead>
            <TableHead>概要</TableHead>
            <TableHead>程度</TableHead>
            <TableHead>状態</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {props.rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>{formatDate(row.occurred_on)}</TableCell>

              <TableCell className="font-mono text-sm text-muted-foreground">
                {row.employee_id !== null ? row.employee_id : "—"}
              </TableCell>

              <TableCell className="hidden text-muted-foreground md:table-cell">
                {row.location ?? "—"}
              </TableCell>

              <TableCell className="max-w-xs truncate">{row.summary}</TableCell>

              <TableCell className="text-muted-foreground">
                {row.severity !== null ? (SEVERITY_LABELS[row.severity] ?? row.severity) : "—"}
              </TableCell>

              <TableCell>
                <Badge variant={row.status === "closed" ? "secondary" : "outline"}>
                  {STATUS_LABELS[row.status] ?? row.status}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
