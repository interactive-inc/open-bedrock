import { EmptyState } from "@/components/empty-state"
import { FetchError } from "@/components/fetch-error"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { getRecruitmentCandidateList } from "@/lib/api/get-recruitment-candidate-list"
import { CandidateStageControls } from "@/app/(app)/recruitment/recruitments/_components/candidate-stage-controls"
import { toCandidateStageLabel } from "@/app/(app)/recruitment/recruitments/_lib/to-candidate-stage-label"

type Props = {
  positionId: number
}

/** GET /job-openings/:id/candidates を取得し、応募者ごとにステージと遷移操作を並べる RSC。 */
export async function CandidatePipeline(props: Props) {
  const candidates = await getRecruitmentCandidateList(props.positionId)

  if (candidates instanceof Error) {
    return <FetchError message="応募者の取得に失敗しました" />
  }

  if (candidates.length === 0) {
    return (
      <EmptyState
        title="応募者はまだいません"
        description="この募集に応募者を追加すると、選考ステージを管理できます。"
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {candidates.map((candidate) => (
        <Card key={candidate.id} className="gap-0 p-0">
          <div className="flex flex-col gap-3 p-4">
            <div className="flex items-center gap-3">
              <Badge variant="secondary">{toCandidateStageLabel(candidate.stage)}</Badge>

              <span className="text-base font-medium">{candidate.name}</span>

              {candidate.email === null ? null : (
                <span className="text-sm text-muted-foreground">{candidate.email}</span>
              )}

              {candidate.source === null ? null : (
                <span className="text-sm text-muted-foreground">経由: {candidate.source}</span>
              )}
            </div>

            <CandidateStageControls
              candidateId={candidate.id}
              positionId={props.positionId}
              stage={candidate.stage}
            />
          </div>
        </Card>
      ))}
    </div>
  )
}
