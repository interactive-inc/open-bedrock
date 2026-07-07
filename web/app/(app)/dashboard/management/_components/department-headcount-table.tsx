import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { DepartmentHeadcount } from "@/app/(app)/dashboard/management/_lib/management-dashboard-types"

type Props = {
  rows: ReadonlyArray<DepartmentHeadcount>
}

// 部署別の在籍人数を表で並べる。
export function DepartmentHeadcountTable(props: Props) {
  if (props.rows.length === 0) {
    return <p className="text-sm text-muted-foreground">部署別の在籍者はいません。</p>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>部署</TableHead>
          <TableHead className="text-right">在籍者数</TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        {props.rows.map((row) => (
          <TableRow key={row.department_name ?? "unassigned"}>
            <TableCell>{row.department_name ?? "（未所属）"}</TableCell>
            <TableCell className="text-right tabular-nums">{row.headcount}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
