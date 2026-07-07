import { notFound } from "next/navigation"
import { Suspense } from "react"
import { HeadcountPlanNewForm } from "@/app/(app)/headcount-plans/_components/headcount-plan-new-form"
import { HeadcountPlanTable } from "@/app/(app)/headcount-plans/_components/headcount-plan-table"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { getMe } from "@/lib/api/get-me"
import { canManageHeadcountPlans } from "@/lib/headcount-plan/can-manage-headcount-plans"
import { canReadHeadcountPlans } from "@/lib/headcount-plan/can-read-headcount-plans"

export const metadata = { title: "人員計画" }

type Props = {
  searchParams: Promise<{ fiscal_year?: string }>
}

// /headcount-plans 人員計画と実在籍数の比較。headcount_plan:read:all が無ければ notFound。
export default async function HeadcountPlansPage(props: Props) {
  const me = await getMe()

  if (me instanceof Error || canReadHeadcountPlans(me.permissions) === false) {
    notFound()
  }

  const canManage = canManageHeadcountPlans(me.permissions)

  const params = await props.searchParams

  const fiscalYearRaw = params.fiscal_year

  const fiscalYear =
    fiscalYearRaw === undefined || fiscalYearRaw === ""
      ? undefined
      : Number.parseInt(fiscalYearRaw, 10)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="人員計画"
        description="年度・部署ごとの計画人数と、実際の在籍数（active）を並べて比較します。"
      />

      {canManage ? <HeadcountPlanNewForm /> : null}

      <Suspense
        key={String(fiscalYear ?? "all")}
        fallback={<ListSkeleton rows={5} rowClassName="h-12 w-full" />}
      >
        <HeadcountPlanTable fiscalYear={Number.isInteger(fiscalYear) ? fiscalYear : undefined} />
      </Suspense>
    </div>
  )
}
