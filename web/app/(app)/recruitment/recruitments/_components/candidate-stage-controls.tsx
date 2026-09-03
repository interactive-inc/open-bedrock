"use client"

import { useActionState } from "react"
import { useRouter } from "next/navigation"
import { advanceCandidateAction } from "@/app/(app)/recruitment/recruitments/actions"
import type { RecruitmentActionState } from "@/app/(app)/recruitment/recruitments/actions"
import { canReject } from "@/app/(app)/recruitment/recruitments/_lib/can-reject"
import { toCandidateStageLabel } from "@/app/(app)/recruitment/recruitments/_lib/to-candidate-stage-label"
import { toNextStage } from "@/app/(app)/recruitment/recruitments/_lib/to-next-stage"
import { Button } from "@/components/ui/button"

const initialState: RecruitmentActionState = { ok: false, error: null }

type Props = {
  candidateId: number
  positionId: number
  stage: string
}

/**
 * 応募者の選考ステージを1つ前進、または不採用にするボタン群。
 * 終端(採用/不採用)ではボタンを出さない。成功時は一覧を再取得する。
 */
export function CandidateStageControls(props: Props) {
  const router = useRouter()

  async function reduce(
    previousState: RecruitmentActionState,
    formData: FormData,
  ): Promise<RecruitmentActionState> {
    const result = await advanceCandidateAction(previousState, formData)

    if (result.ok) {
      router.refresh()
    }

    return result
  }

  const action = useActionState(reduce, initialState)

  const state = action[0]

  const formAction = action[1]

  const pending = action[2]

  const nextStage = toNextStage(props.stage)

  const rejectable = canReject(props.stage)

  if (nextStage === null && rejectable === false) {
    return <p className="text-sm text-muted-foreground">選考は終了しています。</p>
  }

  return (
    <div className="flex flex-col gap-2">
      <form action={formAction} className="flex items-center gap-2">
        <input type="hidden" name="candidate_id" value={props.candidateId} />

        <input type="hidden" name="position_id" value={props.positionId} />

        {nextStage === null ? null : (
          <Button type="submit" name="stage" value={nextStage} size="sm" disabled={pending}>
            {toCandidateStageLabel(nextStage)}へ進める
          </Button>
        )}

        {rejectable ? (
          <Button
            type="submit"
            name="stage"
            value="rejected"
            size="sm"
            variant="outline"
            disabled={pending}
          >
            不採用にする
          </Button>
        ) : null}
      </form>

      {state.error === null ? null : <p className="text-sm text-destructive">{state.error}</p>}
    </div>
  )
}
