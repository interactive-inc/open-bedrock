import { FetchError } from "@/components/fetch-error"
import { notFound } from "next/navigation"
import { EmployeeDeleteButton } from "@/app/(app)/employees/_components/employee-delete-button"
import { EmployeeEditForm } from "@/app/(app)/employees/_components/employee-edit-form"
import { EmployeeStatusBadge } from "@/app/(app)/employees/_components/employee-status-badge"
import { DetailField } from "@/components/detail-field"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getEmployeeByCode } from "@/lib/api/get-employee-by-code"
import { canDeleteEmployee } from "@/lib/employee/can-delete-employee"
import { canUpdateEmployee } from "@/lib/employee/can-update-employee"

type Props = {
  code: string
  permissions: ReadonlyArray<string>
  currentUserCode: string
}

// code 指定で従業員を取得し、詳細カードを描画する非同期 RSC。
// 該当なしは notFound、取得失敗はエラーメッセージ。
// permissions に応じて編集フォーム・削除ボタンの導線を出す。自分自身は削除ボタンを出さない。
export async function EmployeeDetail(props: Props) {
  const employee = await getEmployeeByCode(props.code)

  if (employee instanceof Error) {
    return <FetchError message="従業員情報の取得に失敗しました" />
  }

  if (employee === null) {
    notFound()
  }

  const showEdit = canUpdateEmployee(props.permissions)

  const showDelete = canDeleteEmployee(props.permissions) && employee.code !== props.currentUserCode

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <CardTitle className="flex items-center gap-3">
            <span className="text-xl font-semibold">{employee.name}</span>

            <EmployeeStatusBadge status={employee.status} />
          </CardTitle>

          {showEdit || showDelete ? (
            <div className="flex flex-wrap items-center gap-2">
              {showEdit ? (
                <EmployeeEditForm
                  code={employee.code}
                  name={employee.name}
                  deptId={null}
                  deptName={employee.deptName}
                  position={employee.position}
                  status={employee.status}
                />
              ) : null}

              {showDelete ? <EmployeeDeleteButton code={employee.code} /> : null}
            </div>
          ) : null}
        </div>
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
