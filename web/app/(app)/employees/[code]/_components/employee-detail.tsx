import { FetchError } from "@/components/fetch-error"
import { notFound } from "next/navigation"
import { EmployeeStatusBadge } from "@/app/(app)/employees/_components/employee-status-badge"
import { DetailField } from "@/components/detail-field"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getEmployeeByCode } from "@/lib/api/get-employee-by-code"

type Props = {
  code: string
}

// code 指定で従業員を取得し、詳細カードを描画する非同期 RSC。
// 該当なしは notFound、取得失敗はエラーメッセージ。
export async function EmployeeDetail(props: Props) {
  const employee = await getEmployeeByCode(props.code)

  if (employee instanceof Error) {
    return <FetchError message="従業員情報の取得に失敗しました" />
  }

  if (employee === null) {
    notFound()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <span className="text-xl font-semibold">{employee.name}</span>

          <EmployeeStatusBadge status={employee.status} />
        </CardTitle>
      </CardHeader>

      <CardContent>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <DetailField label="コード">{employee.code}</DetailField>

          <DetailField label="部署">{employee.deptName ?? "-"}</DetailField>

          <DetailField label="役職">{employee.position ?? "-"}</DetailField>

          <DetailField label="メール">{employee.email}</DetailField>

          <DetailField label="ロール">{employee.role}</DetailField>
        </dl>
      </CardContent>
    </Card>
  )
}
