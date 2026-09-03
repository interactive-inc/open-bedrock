import { SalaryRevisionCreateForm } from "@/app/(app)/company/employees/[employee]/_components/salary-revision-create-form"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getSalaryRevisionList } from "@/lib/api/get-salary-revision-list"

type Props = {
  code: string
  canManage: boolean
}

/**
 * 従業員の給与改定履歴セクション。最機微のため salary_revision:read:all が無いと api は 403 を返し、
 * その場合はセクション自体を描画しない（本人にも self 例外は無い）。
 * salary_revision:manage を持つ場合は空でも表示し、記録の登録導線を出す。
 */
export async function EmployeeSalaryRevisionHistory(props: Props) {
  const revisions = await getSalaryRevisionList({ employeeCode: props.code })

  if (revisions instanceof Error) {
    return null
  }

  if (revisions.length === 0 && props.canManage === false) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>給与改定</CardTitle>

        {props.canManage ? (
          <CardAction>
            <SalaryRevisionCreateForm employeeCode={props.code} />
          </CardAction>
        ) : null}
      </CardHeader>

      <CardContent>
        {revisions.length === 0 ? (
          <p className="text-sm text-muted-foreground">給与改定の記録はありません。</p>
        ) : (
          <div className="overflow-x-auto">
            <Table aria-label="給与改定履歴">
              <TableHeader>
                <TableRow>
                  <TableHead>適用日</TableHead>
                  <TableHead className="text-right">前回基本給</TableHead>
                  <TableHead className="text-right">改定後基本給</TableHead>
                  <TableHead>理由</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {revisions.map((revision) => (
                  <TableRow key={revision.id}>
                    <TableCell>{revision.effective_date}</TableCell>

                    <TableCell className="text-right tabular-nums">
                      {revision.previous_base_salary.toLocaleString("ja-JP")}円
                    </TableCell>

                    <TableCell className="text-right tabular-nums">
                      {revision.new_base_salary.toLocaleString("ja-JP")}円
                    </TableCell>

                    <TableCell>{revision.reason ?? "-"}</TableCell>
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
