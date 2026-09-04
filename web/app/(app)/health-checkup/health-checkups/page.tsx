import { Plus } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { HealthCheckupsSection } from "@/app/(app)/health-checkup/health-checkups/_components/health-checkups-section"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { getMe } from "@/lib/api/get-me"
import { canManageHealthCheckups } from "@/lib/health-checkup/can-manage-health-checkups"
import { canViewAllHealthCheckups } from "@/lib/health-checkup/can-view-all-health-checkups"

export const metadata = { title: "健診の実施記録" }

type SearchParams = Promise<{ [key: string]: string | Array<string> | undefined }>

/**
 * 健診・ストレスチェックの実施記録一覧（人事向け）。要配慮情報のため health_checkup:read:all を
 * 持つロール(hr / admin)のみ表示できる。権限が無ければ notFound。結果は一切表示しない（実施情報のみ）。
 */
export default async function HealthCheckupsPage(props: { searchParams: SearchParams }) {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canViewAllHealthCheckups(currentUser.permissions) === false) {
    notFound()
  }

  const params = await props.searchParams

  const fiscalYear = toFiscalYear(toSingleValue(params.fiscal_year))

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="健診の実施記録">
        {canManageHealthCheckups(currentUser.permissions) ? (
          <Button nativeButton={false} render={<Link href="/health-checkup/health-checkups/new" />}>
            <Plus />
            実施記録を登録
          </Button>
        ) : null}
      </PageHeader>

      <Suspense
        key={String(fiscalYear ?? "")}
        fallback={<ListSkeleton rows={5} rowClassName="h-12 w-full" />}
      >
        <HealthCheckupsSection fiscalYear={fiscalYear} />
      </Suspense>
    </div>
  )
}

function toSingleValue(value: string | Array<string> | undefined): string | null {
  if (typeof value !== "string") {
    return null
  }

  if (value === "") {
    return null
  }

  return value
}

function toFiscalYear(raw: string | null): number | undefined {
  if (raw === null) {
    return undefined
  }

  const parsed = Number(raw)

  if (Number.isInteger(parsed) === false) {
    return undefined
  }

  return parsed
}
