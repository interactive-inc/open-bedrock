import { employeeEventKindLabel } from "@/app/(app)/organization/employees/[employee]/_lib/employee-event-kind-label"
import { getEmployeeEventList } from "@/lib/api/get-employee-event-list"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type Props = {
  code: string
}

/**
 * 従業員の異動・在籍履歴セクション。閲覧権限がない場合 api は 403 を返すため、
 * 取得が Error のときはセクション自体を描画しない（空表示ではなく非表示）。
 */
export async function EmployeeEventHistory(props: Props) {
  const events = await getEmployeeEventList({ employeeCode: props.code, kind: null })

  if (events instanceof Error) {
    return null
  }

  if (events.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>異動・在籍履歴</CardTitle>
      </CardHeader>

      <CardContent>
        <div className="overflow-x-auto">
          <Table aria-label="異動・在籍履歴">
            <TableHeader>
              <TableRow>
                <TableHead>適用日</TableHead>
                <TableHead>種別</TableHead>
                <TableHead>異動元</TableHead>
                <TableHead>異動先</TableHead>
                <TableHead>備考</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {events.map((event) => (
                <TableRow key={event.id}>
                  <TableCell>{event.effective_date}</TableCell>

                  <TableCell>
                    <Badge variant="outline">{employeeEventKindLabel(event.kind)}</Badge>
                  </TableCell>

                  <TableCell className="text-muted-foreground">
                    {event.from_department_code ?? "-"}
                  </TableCell>

                  <TableCell className="text-muted-foreground">
                    {event.to_department_code ?? "-"}
                  </TableCell>

                  <TableCell className="text-muted-foreground">{event.note ?? "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
