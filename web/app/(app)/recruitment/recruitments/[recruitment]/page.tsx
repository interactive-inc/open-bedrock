import { notFound } from "next/navigation"
import { Suspense } from "react"
import { CandidateNewForm } from "@/app/(app)/recruitment/recruitments/_components/candidate-new-form"
import { CandidatePipeline } from "@/app/(app)/recruitment/recruitments/_components/candidate-pipeline"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { getMe } from "@/lib/api/get-me"
import { canManageRecruitment } from "@/lib/recruitment/can-manage-recruitment"

export const metadata = { title: "応募者パイプライン" }

type Props = {
  params: Promise<{ recruitment: string }>
}

/** /recruitment/:id 募集配下の応募者パイプライン。recruitment:manage が無ければ notFound。 */
export default async function RecruitmentPositionPage(props: Props) {
  const me = await getMe()

  if (me instanceof Error || canManageRecruitment(me.permissions) === false) {
    notFound()
  }

  const params = await props.params

  const positionId = Number.parseInt(params.recruitment, 10)

  if (Number.isInteger(positionId) === false || positionId <= 0) {
    notFound()
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="応募者パイプライン" />

      <CandidateNewForm positionId={positionId} />

      <Suspense fallback={<ListSkeleton rows={5} rowClassName="h-16 w-full" />}>
        <CandidatePipeline positionId={positionId} />
      </Suspense>
    </div>
  )
}
