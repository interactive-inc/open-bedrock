import { formatDateTime } from "@/lib/format-date-time"
import Link from "next/link"
import { ApplicationStatusBadge } from "@/components/application-status-badge"
import { EmptyState } from "@/components/empty-state"
import { SortableTableHead } from "@/components/sortable-table-head"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { RingiAdminSort } from "@/lib/api/get-ringi-admin-list"
import type { RingiStatus } from "@/lib/api/types/ringi-types"

const amountFormatter = new Intl.NumberFormat("ja-JP")

export type RingiAdminRow = {
  id: number
  applicant_id: string
  applicant_name: string
  applicant_dept_name: string | null
  approver_id: string
  approver_name: string
  title: string
  amount: number
  status: RingiStatus
  decided_at: string | null
  created_at: string
}

type Props = {
  rows: ReadonlyArray<RingiAdminRow>
  total: number
  currentSort: RingiAdminSort
  extraParams: Record<string, string | undefined>
}

export function RingiAdminTable(props: Props) {
  if (props.rows.length === 0) {
    return <EmptyState title="条件に一致する稟議がありません" />
  }

  return (
    <div className="overflow-x-auto">
      <Table aria-label={`全社の稟議 ${props.total} 件`}>
        <TableHeader>
          <TableRow>
            <TableHead>起案者</TableHead>
            <TableHead className="hidden md:table-cell">部署</TableHead>
            <TableHead>承認者</TableHead>
            <TableHead>件名</TableHead>
            <SortableTableHead
              pathname="/ringi/ringis"
              currentSort={props.currentSort}
              ascValue="amount_asc"
              descValue="amount_desc"
              label="金額"
              extraParams={props.extraParams}
            />
            <TableHead>ステータス</TableHead>
            <SortableTableHead
              pathname="/ringi/ringis"
              currentSort={props.currentSort}
              ascValue="created_at_asc"
              descValue="created_at_desc"
              label="起案日"
              className="hidden md:table-cell"
              extraParams={props.extraParams}
            />
          </TableRow>
        </TableHeader>

        <TableBody>
          {props.rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-medium">
                <Link
                  href={`/ringi/ringis?applicant_id=${row.applicant_id}`}
                  className="underline-offset-4 hover:underline"
                  aria-label={`${row.applicant_name} の稟議で絞り込む`}
                >
                  {row.applicant_name}
                </Link>
              </TableCell>

              <TableCell className="hidden text-muted-foreground md:table-cell">
                {row.applicant_dept_name ?? "—"}
              </TableCell>

              <TableCell className="text-muted-foreground">{row.approver_name}</TableCell>

              <TableCell>{row.title}</TableCell>

              <TableCell className="tabular-nums">
                {amountFormatter.format(row.amount)} 円
              </TableCell>

              <TableCell>
                <ApplicationStatusBadge status={row.status} />
              </TableCell>

              <TableCell className="hidden text-muted-foreground md:table-cell">
                {formatDateTime(row.created_at)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
