import Link from "next/link"
import { Suspense } from "react"
import { PayslipStatusBadge } from "@/components/payslip-status-badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { getPayslipDetail } from "@/lib/api/get-payslip-detail"

export const metadata = { title: "給与明細詳細" }

type Props = {
  params: Promise<{ id: string }>
}

const amountFormatter = new Intl.NumberFormat("ja-JP")

// 給与明細詳細画面。params.id で対象を取得し、支給・控除の内訳を描画する RSC。
export default async function PayslipDetailPage(props: Props) {
  const params = await props.params

  return (
    <div className="flex flex-col gap-6">
      <Link href="/payroll" className="text-sm text-muted-foreground hover:text-foreground">
        ← 給与明細一覧へ戻る
      </Link>

      <Suspense fallback={<PayslipDetailSkeleton />}>
        <PayslipDetailView id={params.id} />
      </Suspense>
    </div>
  )
}

type ViewProps = {
  id: string
}

// /payslips/:id を認証付きで取得して詳細カードを描画する非同期 RSC。
async function PayslipDetailView(props: ViewProps) {
  const payslipId = Number(props.id)

  if (!Number.isInteger(payslipId) || payslipId <= 0) {
    return <p className="text-sm text-destructive">給与明細 ID が不正です</p>
  }

  const payslip = await getPayslipDetail(payslipId)

  if (payslip instanceof Error) {
    return <p className="text-sm text-destructive">給与明細詳細の取得に失敗しました</p>
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <CardTitle>{payslip.period} の給与明細</CardTitle>

          <PayslipStatusBadge status={payslip.status} />
        </div>
      </CardHeader>

      <CardContent>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <dt className="text-sm text-muted-foreground">基本給</dt>

            <dd className="text-sm font-medium tabular-nums">
              {amountFormatter.format(payslip.base_salary)} 円
            </dd>
          </div>

          <div className="flex flex-col gap-1">
            <dt className="text-sm text-muted-foreground">手当</dt>

            <dd className="text-sm font-medium tabular-nums">
              {amountFormatter.format(payslip.allowances)} 円
            </dd>
          </div>

          <div className="flex flex-col gap-1">
            <dt className="text-sm text-muted-foreground">控除</dt>

            <dd className="text-sm font-medium tabular-nums">
              {amountFormatter.format(payslip.deductions)} 円
            </dd>
          </div>

          <div className="flex flex-col gap-1">
            <dt className="text-sm text-muted-foreground">差引支給額</dt>

            <dd className="text-base font-semibold tabular-nums">
              {amountFormatter.format(payslip.net_pay)} 円
            </dd>
          </div>

          <div className="flex flex-col gap-1">
            <dt className="text-sm text-muted-foreground">発行日</dt>

            <dd className="text-sm font-medium">{payslip.issued_at ?? "-"}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  )
}

function PayslipDetailSkeleton() {
  return <Skeleton className="h-64 w-full" />
}
