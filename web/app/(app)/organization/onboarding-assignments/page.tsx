import Link from "next/link"
import { BackButton } from "@/components/back-button"
import { EmptyState } from "@/components/empty-state"
import { FetchError } from "@/components/fetch-error"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getEmployeeDirectory } from "@/lib/api/get-employee-directory"
import { requirePermission } from "@/lib/auth/require-permission"
import { canManageOnboarding } from "@/lib/onboarding/can-manage-onboarding"

export const metadata = { title: "社員別オンボーディング" }

export default async function OnboardingEmployeesPage() {
  const currentUser = await requirePermission("onboarding:view:all")

  const canManage = canManageOnboarding(currentUser.permissions)

  const employees = await getEmployeeDirectory({}, { limit: 100 })

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="社員別オンボーディング"
        description="社員を選んで割当とタスクの進捗を確認します。"
        actions={
          <>
            {canManage ? (
              <Button
                nativeButton={false}
                render={<Link href="/organization/onboarding-assignments/new" />}
              >
                新規割当
              </Button>
            ) : null}

            <BackButton href="/organization/onboarding-assignments" label="ハブへ戻る" />
          </>
        }
      />

      {employees instanceof Error ? (
        <FetchError message="社員ディレクトリを取得できませんでした" />
      ) : employees.items.length === 0 ? (
        <EmptyState title="表示できる社員がいません" />
      ) : (
        <div className="overflow-x-auto">
          <Table aria-label="社員別オンボーディング">
            <TableHeader>
              <TableRow>
                <TableHead>社員コード</TableHead>
                <TableHead>氏名</TableHead>
                <TableHead>部署</TableHead>
                <TableHead>役職</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {employees.items.map((employee) => (
                <TableRow key={employee.code}>
                  <TableCell>
                    <Link
                      href={`/organization/employees/${employee.code}/onboarding`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {employee.code}
                    </Link>
                  </TableCell>
                  <TableCell>{employee.name}</TableCell>
                  <TableCell>{employee.deptName ?? "-"}</TableCell>
                  <TableCell>{employee.position ?? "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
