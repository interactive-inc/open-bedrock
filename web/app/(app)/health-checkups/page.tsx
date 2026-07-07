import { notFound } from "next/navigation"
import { Suspense } from "react"
import { HealthCheckupsSection } from "@/app/(app)/health-checkups/_components/health-checkups-section"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { getMe } from "@/lib/api/get-me"
import { canViewAllHealthCheckups } from "@/lib/health-checkup/can-view-all-health-checkups"

export const metadata = { title: "健康診断" }

type SearchParams = Promise<{ [key: string]: string | Array<string> | undefined }>

// 健診・ストレスチェックの実施記録一覧（人事向け）。要配慮情報のため health_checkup:read:all を
// 持つロール(hr / admin)のみ表示できる。権限が無ければ notFound。結果は一切表示しない（実施情報のみ）。
export default async function HealthCheckupsPage(props: { searchParams: SearchParams }) {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canViewAllHealthCheckups(currentUser.permissions) === false) {
    notFound()
  }

  const params = await props.searchParams

  const fiscalYear = toFiscalYear(toSingleValue(params.fiscal_year))

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="健康診断"
        description="健診・ストレスチェックの実施状況を確認します。結果は保持せず、実施日と受診状態のみを記録します。"
      />

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
