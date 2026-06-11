import { notFound } from "next/navigation"
import { EmployeeStatusBadge } from "@/app/(app)/employees/_components/employee-status-badge"
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
    return <p className="text-sm text-destructive">従業員情報の取得に失敗しました</p>
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
          <DetailRow label="コード" value={employee.code} />

          <DetailRow label="部署" value={employee.deptName ?? "-"} />

          <DetailRow label="役職" value={employee.position ?? "-"} />

          <DetailRow label="メール" value={employee.email} />

          <DetailRow label="ロール" value={employee.role} />
        </dl>
      </CardContent>
    </Card>
  )
}

type DetailRowProps = {
  label: string
  value: string
}

// 詳細の 1 項目（ラベル + 値）を縦並びで表示する。
function DetailRow(props: DetailRowProps) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-sm text-muted-foreground">{props.label}</dt>

      <dd className="text-sm">{props.value}</dd>
    </div>
  )
}
