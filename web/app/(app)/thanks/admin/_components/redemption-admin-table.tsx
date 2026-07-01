import Link from "next/link"
import { Badge } from "@/components/ui/badge"
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
import type { RedemptionAdminSort, RedemptionStatus } from "@/lib/api/get-redemption-admin-list"

const pointFormatter = new Intl.NumberFormat("ja-JP")

export type RedemptionAdminRow = {
  id: number
  employee_id: number
  employee_name: string
  employee_dept_name: string | null
  reward_id: number
  reward_name: string
  point_cost: number
  status: RedemptionStatus
  created_at: string
  decided_at: string | null
  decider_id: number | null
}

type Props = {
  rows: ReadonlyArray<RedemptionAdminRow>
  total: number
  currentSort: RedemptionAdminSort
  extraParams: Record<string, string | undefined>
}

function StatusBadge(props: { status: RedemptionStatus }) {
  if (props.status === "fulfilled") {
    return <Badge className="bg-emerald-600 text-white">交換済み</Badge>
  }

  if (props.status === "rejected") {
    return <Badge variant="destructive">却下</Badge>
  }

  return <Badge variant="secondary">承認待ち</Badge>
}

export function RedemptionAdminTable(props: Props) {
  if (props.rows.length === 0) {
    return <EmptyState title="条件に一致する交換申請がありません" />
  }

  return (
    <div className="overflow-x-auto">
      <Table aria-label={`全社の交換申請 ${props.total} 件`}>
        <TableHeader>
          <TableRow>
            <TableHead>景品</TableHead>
            <TableHead>申請者</TableHead>
            <TableHead className="hidden md:table-cell">部署</TableHead>
            <TableHead>ポイント</TableHead>
            <TableHead>ステータス</TableHead>
            <SortableTableHead
              pathname="/thanks/admin"
              currentSort={props.currentSort}
              ascValue="created_at_asc"
              descValue="created_at_desc"
              label="申請日"
              className="hidden md:table-cell"
              extraParams={props.extraParams}
            />
          </TableRow>
        </TableHeader>

        <TableBody>
          {props.rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-medium">{row.reward_name}</TableCell>

              <TableCell className="text-muted-foreground">
                <Link
                  href={`/thanks/admin?employee_id=${row.employee_id}`}
                  className="underline-offset-4 hover:underline"
                  aria-label={`${row.employee_name} の交換申請で絞り込む`}
                >
                  {row.employee_name}
                </Link>
              </TableCell>

              <TableCell className="hidden text-muted-foreground md:table-cell">
                {row.employee_dept_name ?? "—"}
              </TableCell>

              <TableCell className="tabular-nums">
                {pointFormatter.format(row.point_cost)} pt
              </TableCell>

              <TableCell>
                <StatusBadge status={row.status} />
              </TableCell>

              <TableCell className="hidden text-muted-foreground md:table-cell">
                {row.created_at}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
