import Link from "next/link"
import { BackButton } from "@/components/back-button"
import { EmptyState } from "@/components/empty-state"
import { FetchError } from "@/components/fetch-error"
import { PageHeader } from "@/components/page-header"
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

export const metadata = { title: "社員別オンボーディング" }

export default async function OnboardingEmployeesPage() {
  await requirePermission("onboarding:view:all")

  const employees = await getEmployeeDirectory({}, { limit: 100 })

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="社員別オンボーディング"
        description="社員を選んで割当とタスクの進捗を確認します。"
        actions={<BackButton href="/onboarding" label="ハブへ戻る" />}
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
                      href={`/onboarding/employee/${employee.code}`}
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
