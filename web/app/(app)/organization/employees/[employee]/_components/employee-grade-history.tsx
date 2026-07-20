import { getEmployeeGradeList } from "@/lib/api/get-employee-grade-list"
import { getGradeList } from "@/lib/api/get-grade-list"
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
 * 従業員の等級付与履歴セクション。閲覧権限がない場合 api は 403 を返すため、
 * 取得が Error のときはセクション自体を描画しない（空表示ではなく非表示）。
 */
export async function EmployeeGradeHistory(props: Props) {
  const assignments = await getEmployeeGradeList({ employeeCode: props.code })

  if (assignments instanceof Error) {
    return null
  }

  if (assignments.length === 0) {
    return null
  }

  const grades = await getGradeList()

  const gradeLabelById = new Map<number, string>()

  if (grades instanceof Error === false) {
    for (const grade of grades) {
      gradeLabelById.set(grade.id, `${grade.code}（${grade.name}）`)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>等級</CardTitle>
      </CardHeader>

      <CardContent>
        <div className="overflow-x-auto">
          <Table aria-label="等級履歴">
            <TableHeader>
              <TableRow>
                <TableHead>適用日</TableHead>
                <TableHead>等級</TableHead>
                <TableHead>理由</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {assignments.map((assignment) => (
                <TableRow key={assignment.id}>
                  <TableCell>{assignment.effective_date}</TableCell>

                  <TableCell className="font-medium">
                    {gradeLabelById.get(assignment.grade_id) ?? `#${assignment.grade_id}`}
                  </TableCell>

                  <TableCell className="text-muted-foreground">
                    {assignment.reason ?? "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
