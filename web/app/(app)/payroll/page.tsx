import Link from "next/link"
import { Suspense } from "react"
import { PayslipStatusBadge } from "@/components/payslip-status-badge"
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
import { getMyPayslips } from "@/lib/api/get-my-payslips"

export const metadata = { title: "給与明細" }

const amountFormatter = new Intl.NumberFormat("ja-JP")

// 給与明細画面。自分の給与明細一覧を RSC で取得しテーブル表示する。
// 給与改定履歴へのリンクも併設する。
export default function PayrollPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">給与明細</h1>

        <Button variant="outline" render={<Link href="/payroll/salary-revisions" />}>
          給与改定履歴
        </Button>
      </div>

      <Suspense fallback={<MyPayslipsSkeleton />}>
        <MyPayslipsTable />
      </Suspense>
    </div>
  )
}

// /payslips/me を認証付きで取得して一覧テーブルを描画する非同期 RSC。
async function MyPayslipsTable() {
  const payslips = await getMyPayslips(null)

  if (payslips instanceof Error) {
    return <p className="text-sm text-destructive">給与明細一覧の取得に失敗しました</p>
  }

  if (payslips.length === 0) {
    return <p className="text-sm text-muted-foreground">発行済みの給与明細はまだありません</p>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>対象期間</TableHead>
          <TableHead>基本給</TableHead>
          <TableHead>差引支給額</TableHead>
          <TableHead>発行日</TableHead>
          <TableHead>ステータス</TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        {payslips.map((payslip) => (
          <TableRow key={payslip.id}>
            <TableCell>
              <Link
                href={`/payroll/${payslip.id}`}
                className="font-medium underline-offset-4 hover:underline"
              >
                {payslip.period}
              </Link>
            </TableCell>

            <TableCell className="tabular-nums">
              {amountFormatter.format(payslip.base_salary)} 円
            </TableCell>

            <TableCell className="tabular-nums">
              {amountFormatter.format(payslip.net_pay)} 円
            </TableCell>

            <TableCell className="text-muted-foreground">{payslip.issued_at ?? "-"}</TableCell>

            <TableCell>
              <PayslipStatusBadge status={payslip.status} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function MyPayslipsSkeleton() {
  const placeholders = [0, 1, 2, 3, 4]

  return (
    <div className="flex flex-col gap-2">
      {placeholders.map((index) => (
        <Skeleton key={index} className="h-12 w-full" />
      ))}
    </div>
  )
}
