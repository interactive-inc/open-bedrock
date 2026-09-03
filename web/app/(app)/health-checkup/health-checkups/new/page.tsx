import { notFound } from "next/navigation"
import { HealthCheckupCreateForm } from "@/app/(app)/health-checkup/health-checkups/_components/health-checkup-create-form"
import { BackButton } from "@/components/back-button"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { getEmployeeDirectory } from "@/lib/api/get-employee-directory"
import { getMe } from "@/lib/api/get-me"
import { canManageHealthCheckups } from "@/lib/health-checkup/can-manage-health-checkups"

export const metadata = { title: "実施記録を登録" }

/**
 * 健診・ストレスチェックの実施記録の登録画面（health_checkup:manage のみ）。
 * 権限が無いユーザーには 404 を返し UI を露出しない。結果は扱わず実施情報のみ登録する。
 */
export default async function HealthCheckupNewPage() {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canManageHealthCheckups(currentUser.permissions) === false) {
    notFound()
  }

  const employeeResult = await getEmployeeDirectory()

  const employees =
    employeeResult instanceof Error
      ? []
      : employeeResult.items.flatMap((employee) =>
          employee.code === null ? [] : [{ code: employee.code, name: employee.name }],
        )

  const defaultFiscalYear = new Date().getFullYear()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="実施記録を登録"
        actions={<BackButton href="/health-checkup/health-checkups" label="一覧に戻る" />}
      />

      <Card>
        <CardContent>
          <HealthCheckupCreateForm employees={employees} defaultFiscalYear={defaultFiscalYear} />
        </CardContent>
      </Card>
    </div>
  )
}
