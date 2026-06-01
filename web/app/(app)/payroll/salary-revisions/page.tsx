import Link from "next/link"
import { Suspense } from "react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getMe } from "@/lib/api/get-me"
import { getSalaryRevisions } from "@/lib/api/get-salary-revisions"
import { canManagePayroll } from "@/lib/payroll/can-manage-payroll"

export const metadata = { title: "給与改定" }

const amountFormatter = new Intl.NumberFormat("ja-JP")

// 給与改定履歴画面。自分の社員コードで改定履歴を RSC で取得しテーブル表示する。
// api 側で特権ロール限定のため、権限不足の場合は注意書きを出す。
export default function SalaryRevisionsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">給与改定履歴</h1>

        <Button variant="outline" render={<Link href="/payroll" />}>
          給与明細へ戻る
        </Button>
      </div>

      <Suspense fallback={<SalaryRevisionsSkeleton />}>
        <SalaryRevisionsTable />
      </Suspense>
    </div>
  )
}

// /me で本人の社員コードを得て /salary-revisions/:employee_code を取得する非同期 RSC。
async function SalaryRevisionsTable() {
  const currentUser = await getMe()

  if (currentUser instanceof Error) {
    return <p className="text-sm text-destructive">本人情報の取得に失敗しました</p>
  }

  if (canManagePayroll(currentUser.role) === false) {
    return (
      <p className="text-sm text-muted-foreground">
        給与改定履歴の閲覧には権限が必要です。管理者にお問い合わせください
      </p>
    )
  }

  const revisions = await getSalaryRevisions(currentUser.code)

  if (revisions instanceof Error) {
    return <p className="text-sm text-destructive">給与改定履歴の取得に失敗しました</p>
  }

  if (revisions.length === 0) {
    return <p className="text-sm text-muted-foreground">給与改定の履歴はまだありません</p>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>適用日</TableHead>
          <TableHead>改定前基本給</TableHead>
          <TableHead>改定後基本給</TableHead>
          <TableHead>理由</TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        {revisions.map((revision) => (
          <TableRow key={revision.id}>
            <TableCell className="font-medium">{revision.effective_date}</TableCell>

            <TableCell className="tabular-nums">
              {amountFormatter.format(revision.previous_base_salary)} 円
            </TableCell>

            <TableCell className="tabular-nums">
              {amountFormatter.format(revision.new_base_salary)} 円
            </TableCell>

            <TableCell className="text-muted-foreground">{revision.reason ?? "-"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function SalaryRevisionsSkeleton() {
  const placeholders = [0, 1, 2, 3, 4]

  return (
    <div className="flex flex-col gap-2">
      {placeholders.map((index) => (
        <Skeleton key={index} className="h-12 w-full" />
      ))}
    </div>
  )
}
