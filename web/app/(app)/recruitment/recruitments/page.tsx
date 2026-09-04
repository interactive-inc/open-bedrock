import { notFound } from "next/navigation"
import { Suspense } from "react"
import { PositionList } from "@/app/(app)/recruitment/recruitments/_components/position-list"
import { PositionNewForm } from "@/app/(app)/recruitment/recruitments/_components/position-new-form"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { getMe } from "@/lib/api/get-me"
import { canManageRecruitment } from "@/lib/recruitment/can-manage-recruitment"

export const metadata = { title: "採用" }

/** /recruitment 募集と応募者のパイプライン。recruitment:manage が無ければ notFound（社外個人情報のため公開しない）。 */
export default async function RecruitmentPage() {
  const me = await getMe()

  if (me instanceof Error || canManageRecruitment(me.permissions) === false) {
    notFound()
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="採用" />

      <PositionNewForm />

      <Suspense fallback={<ListSkeleton rows={5} rowClassName="h-16 w-full" />}>
        <PositionList />
      </Suspense>
    </div>
  )
}
