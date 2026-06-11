import Link from "next/link"
import { PayslipCorrectForm } from "@/app/(app)/payroll/admin/_components/payslip-correct-form"
import { PayslipIssueForm } from "@/app/(app)/payroll/admin/_components/payslip-issue-form"
import { SalaryRevisionCreateForm } from "@/app/(app)/payroll/admin/_components/salary-revision-create-form"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getMe } from "@/lib/api/get-me"
import { canManagePayroll } from "@/lib/payroll/can-manage-payroll"

export const metadata = { title: "給与管理" }

// 給与管理画面（特権ロール向け）。給与明細の発行と給与改定の作成フォームを並べる RSC。
// 非特権ロールには注意書きを出す（実発行は api 側でも 403 で弾かれる）。
export default async function PayrollAdminPage() {
  const currentUser = await getMe()

  const canManage = currentUser instanceof Error ? false : canManagePayroll(currentUser.role)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">給与管理</h1>

        <Button variant="outline" render={<Link href="/payroll" />}>
          給与明細へ戻る
        </Button>
      </div>

      {canManage === false ? (
        <p className="text-sm text-muted-foreground">
          給与の発行・改定には権限が必要です。管理者にお問い合わせください
        </p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>給与明細を発行</CardTitle>
            </CardHeader>

            <CardContent>
              <PayslipIssueForm />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>給与改定を作成</CardTitle>
            </CardHeader>

            <CardContent>
              <SalaryRevisionCreateForm />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>給与明細を訂正・取消</CardTitle>
            </CardHeader>

            <CardContent>
              <PayslipCorrectForm />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
