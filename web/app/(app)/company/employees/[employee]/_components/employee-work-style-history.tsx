import { getEmployeeWorkStyleList } from "@/lib/api/get-employee-work-style-list"
import { toWorkStyleLabel } from "@/app/(app)/company/employees/[employee]/_lib/work-style-label"
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
 * 従業員の勤務形態セクション。閲覧権限がない場合 api は 403 を返すため、
 * 取得が Error のときはセクション自体を描画しない（空表示ではなく非表示）。
 */
export async function EmployeeWorkStyleHistory(props: Props) {
  const workStyles = await getEmployeeWorkStyleList({ employeeCode: props.code })

  if (workStyles instanceof Error) {
    return null
  }

  if (workStyles.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>勤務形態</CardTitle>
      </CardHeader>

      <CardContent>
        <div className="overflow-x-auto">
          <Table aria-label="勤務形態">
            <TableHeader>
              <TableRow>
                <TableHead>区分</TableHead>

                <TableHead>開始日</TableHead>

                <TableHead>終了日</TableHead>

                <TableHead>メモ</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {workStyles.map((workStyle) => (
                <TableRow key={workStyle.id}>
                  <TableCell>{toWorkStyleLabel(workStyle.style)}</TableCell>

                  <TableCell>{workStyle.starts_on}</TableCell>

                  <TableCell>{workStyle.ends_on ?? "-"}</TableCell>

                  <TableCell>{workStyle.note ?? "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
