import Link from "next/link"
import { Suspense } from "react"
import { OvertimeFilterForm } from "@/app/(app)/attendance/attendances/overtime/_components/overtime-filter-form"
import { OvertimeSummarySection } from "@/app/(app)/attendance/attendances/overtime/_components/overtime-summary-section"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { getMe } from "@/lib/api/get-me"
import { canReadAllOvertime } from "@/lib/attendance/can-read-all-overtime"
import { canReadReportsOvertime } from "@/lib/attendance/can-read-reports-overtime"
import type { OvertimeScope } from "@/lib/api/types/overtime-types"

export const metadata = { title: "時間外の集計" }

type Props = {
  searchParams: Promise<{ month?: string; scope?: string }>
}

/**
 * 時間外の集計画面。月・範囲で絞り込み、従業員ごとの参考集計を表示する RSC。
 * 範囲(scope)は権限に応じて出し分ける。集計は法定判定ではない参考値。
 */
export default async function OvertimeSummaryPage(props: Props) {
  const searchParams = await props.searchParams

  const month = typeof searchParams.month === "string" ? searchParams.month : null

  const scope = toScope(searchParams.scope)

  const currentUser = await getMe()

  const permissions = currentUser instanceof Error ? [] : currentUser.permissions

  const canReadReports = canReadReportsOvertime(permissions)

  const canReadAll = canReadAllOvertime(permissions)

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="時間外の集計">
        <Button variant="secondary" nativeButton={false} render={<Link href="/my/attendances" />}>
          勤怠へ
        </Button>
      </PageHeader>

      <OvertimeFilterForm
        month={month}
        scope={scope}
        canReadReports={canReadReports}
        canReadAll={canReadAll}
      />

      <Suspense key={`${month ?? ""}:${scope ?? ""}`} fallback={<ListSkeleton rows={5} />}>
        <OvertimeSummarySection month={month} scope={scope} />
      </Suspense>
    </div>
  )
}

/** searchParams の scope を reports/all のみ許容し、それ以外は null（本人のみ）にする。 */
function toScope(raw: string | undefined): OvertimeScope | null {
  if (raw === "reports" || raw === "all") {
    return raw
  }

  return null
}
