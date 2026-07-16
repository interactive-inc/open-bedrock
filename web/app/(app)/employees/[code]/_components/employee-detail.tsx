import { FetchError } from "@/components/fetch-error"
import { notFound } from "next/navigation"
import { EmployeeArchiveButton } from "@/app/(app)/employees/_components/employee-archive-button"
import { EmployeeEditForm } from "@/app/(app)/employees/_components/employee-edit-form"
import { EmployeeStatusBadge } from "@/app/(app)/employees/_components/employee-status-badge"
import { DetailField } from "@/components/detail-field"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getEmployeeByCode } from "@/lib/api/get-employee-by-code"
import { canArchiveEmployee } from "@/lib/employee/can-archive-employee"
import { canUpdateEmployee } from "@/lib/employee/can-update-employee"
import { getEmployeeLifecycleState } from "@/lib/api/get-employee-lifecycle-state"
import { getEmployeeLifecycleEvents } from "@/lib/api/get-employee-lifecycle-events"
import { EmployeeLifecycleSummary } from "@/app/(app)/employees/[code]/_components/employee-lifecycle-summary"
import { EmployeeLifecycleTimeline } from "@/app/(app)/employees/[code]/_components/employee-lifecycle-timeline"
import { PersonnelActionForm } from "@/app/(app)/employees/[code]/_components/personnel-action-form"
import { PersonnelActionRequestList } from "@/app/(app)/employees/[code]/_components/personnel-action-request-list"
import { listPersonnelActionRequests } from "@/lib/api/list-personnel-action-requests"

type Props = {
  code: string
  permissions: ReadonlyArray<string>
  currentUserCode: string
}

// code 指定で従業員を取得し、詳細カードを描画する非同期 RSC。
// 該当なしは notFound、取得失敗はエラーメッセージ。
// permissions と現在のライフサイクル状態に応じて、編集・人事発令・アーカイブ導線を出す。
export async function EmployeeDetail(props: Props) {
  const [employee, lifecycleState, lifecycleEvents, lifecycleRequests] = await Promise.all([
    getEmployeeByCode(props.code),
    getEmployeeLifecycleState(props.code),
    getEmployeeLifecycleEvents(props.code),
    listPersonnelActionRequests(props.code),
  ])

  if (employee instanceof Error) {
    return <FetchError message="従業員情報の取得に失敗しました" />
  }

  if (employee === null) {
    notFound()
  }

  const showEdit = canUpdateEmployee(props.permissions)

  const showArchive =
    !(lifecycleState instanceof Error) &&
    lifecycleState.status === "retired" &&
    !lifecycleState.archived &&
    canArchiveEmployee(props.permissions) &&
    employee.code !== props.currentUserCode
  const canRequestLifecycle = props.permissions.includes("employee:lifecycle:request")
  const canApplyLifecycle = props.permissions.includes("employee:lifecycle:apply")
  const showPersonnelAction =
    !(lifecycleState instanceof Error) && (canRequestLifecycle || canApplyLifecycle)

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <CardTitle className="flex items-center gap-3">
              <span className="text-xl font-semibold">{employee.name}</span>

              <EmployeeStatusBadge status={employee.status} />
            </CardTitle>

            {showEdit || showArchive || showPersonnelAction ? (
              <div className="flex flex-wrap items-center gap-2">
                {showPersonnelAction && !(lifecycleState instanceof Error) ? (
                  <PersonnelActionForm
                    employeeCode={employee.code}
                    employeeRevision={lifecycleState.employee_revision}
                    organizationRevision={lifecycleState.organization_revision}
                    canRequest={canRequestLifecycle}
                    canApply={canApplyLifecycle}
                  />
                ) : null}

                {showEdit ? <EmployeeEditForm code={employee.code} name={employee.name} /> : null}

                {showArchive ? <EmployeeArchiveButton code={employee.code} /> : null}
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

      {lifecycleState instanceof Error ? (
        <FetchError message="現在の人事状態の取得に失敗しました" />
      ) : (
        <EmployeeLifecycleSummary state={lifecycleState} />
      )}

      {lifecycleEvents instanceof Error ? (
        <FetchError message="人事タイムラインの取得に失敗しました" />
      ) : (
        <EmployeeLifecycleTimeline code={employee.code} events={lifecycleEvents} />
      )}

      {lifecycleRequests instanceof Error ? null : (
        <PersonnelActionRequestList data={lifecycleRequests} />
      )}
    </div>
  )
}
