import { EmployeeEventCreateForm } from "@/app/(app)/company/employees/[employee]/_components/employee-event-create-form"
import { toEmployeeEventKindLabel } from "@/lib/employee-event/to-employee-event-kind-label"
import { getEmployeeEventList } from "@/lib/api/get-employee-event-list"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"

type Props = {
  code: string
  canManage: boolean
}

/**
 * 従業員の異動・在籍履歴セクション。閲覧権限がない場合 api は 403 を返すため、
 * 取得が Error のときはセクション自体を描画しない（空表示ではなく非表示）。
 * employee_event:manage を持つ場合は空でも表示し、記録の登録導線を出す。
 */
export async function EmployeeEventHistory(props: Props) {
  const events = await getEmployeeEventList({ employeeCode: props.code, kind: null })

  if (events instanceof Error) {
    return null
  }

  if (events.length === 0 && props.canManage === false) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>異動・在籍履歴</CardTitle>

        {props.canManage ? (
          <CardAction>
            <EmployeeEventCreateForm employeeCode={props.code} />
          </CardAction>
        ) : null}
      </CardHeader>

      <CardContent>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">異動・在籍イベントの記録はありません。</p>
        ) : (
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
                      <Button type="button" variant="secondary" size="sm">
                        {toEmployeeEventKindLabel(event.kind)}
                      </Button>
                    </TableCell>

                    <TableCell>{event.from_department_code ?? "-"}</TableCell>

                    <TableCell>{event.to_department_code ?? "-"}</TableCell>

                    <TableCell>{event.note ?? "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
