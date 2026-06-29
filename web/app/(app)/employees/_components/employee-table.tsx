import Link from "next/link"
import { EmployeeStatusBadge } from "@/app/(app)/employees/_components/employee-status-badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { EmployeeListItem } from "@/lib/api/types/employee-list-item"

type Props = {
  employees: ReadonlyArray<EmployeeListItem>
}

// 従業員一覧テーブル。各行は code セルの stretched link で詳細 /employees/:code へ遷移する。
export function EmployeeTable(props: Props) {
  if (props.employees.length === 0) {
    return <p className="text-sm text-muted-foreground">条件に一致する従業員がいません</p>
  }

  return (
    <div className="overflow-x-auto">
      <Table aria-label="一覧">
        <TableHeader>
          <TableRow>
            <TableHead>コード</TableHead>
            <TableHead>氏名</TableHead>
            <TableHead>部署</TableHead>
            <TableHead>役職</TableHead>
            <TableHead>メール</TableHead>
            <TableHead>在籍状況</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {props.employees.map((employee) => (
            <TableRow key={employee.code} className="relative cursor-pointer hover:bg-muted">
              <TableCell className="font-medium">
                <Link href={`/employees/${employee.code}`} className="after:absolute after:inset-0">
                  {employee.code}
                </Link>
              </TableCell>

              <TableCell>{employee.name}</TableCell>

              <TableCell>{employee.deptName ?? "-"}</TableCell>

              <TableCell>{employee.position ?? "-"}</TableCell>

              <TableCell className="text-muted-foreground">{employee.email}</TableCell>

              <TableCell>
                <EmployeeStatusBadge status={employee.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
