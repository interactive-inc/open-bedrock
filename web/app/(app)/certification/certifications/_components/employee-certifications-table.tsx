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
import type { EmployeeCertificationResponse } from "@/lib/api/types/certification-types"

type Props = {
  rows: ReadonlyArray<EmployeeCertificationResponse>
}

/** 資格保有記録テーブル。取得日・有効期限を表示する（更新要否の判定はしない）。 */
export function EmployeeCertificationsTable(props: Props) {
  if (props.rows.length === 0) {
    return <EmptyState title="保有資格の記録がありません" />
  }

  return (
    <div className="overflow-x-auto">
      <Table aria-label={`保有資格 ${props.rows.length} 件`}>
        <TableHeader>
          <TableRow>
            <TableHead>資格 ID</TableHead>
            <TableHead>取得日</TableHead>
            <TableHead>有効期限</TableHead>
            <TableHead className="hidden md:table-cell">備考</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {props.rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>{row.certification_id}</TableCell>

              <TableCell>{formatDate(row.acquired_on)}</TableCell>

              <TableCell>{row.expires_on !== null ? formatDate(row.expires_on) : "—"}</TableCell>

              <TableCell className="hidden md:table-cell">{row.note ?? "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
