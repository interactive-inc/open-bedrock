"use client"

import { useActionState } from "react"
import { toast } from "sonner"
import type { TrainingFormState } from "@/app/(app)/training/trainings/actions"
import { completeTrainingEnrollmentAction } from "@/app/(app)/training/trainings/actions"
import { Button } from "@/components/ui/button"

type Props = {
  enrollmentId: number
}

const initialState: TrainingFormState = { ok: false, error: null }

/**
 * 受講を完了にするボタン。enrollment_id を hidden input で Server Action へ送る。
 * 成功・失敗は action の結果を見て toast() で出す（useEffect は使わない）。
 */
export function CompleteEnrollmentButton(props: Props) {
  // action 実行時（送信時）に結果を見て toast する。レンダー中には副作用を起こさない。
  const action = useActionState(async (previousState: TrainingFormState, formData: FormData) => {
    const next = await completeTrainingEnrollmentAction(previousState, formData)

    if (next.ok) {
      toast.success("受講を完了しました")
    } else if (next.error !== null) {
      toast.error(next.error)
    }

    return next
  }, initialState)

  const dispatch = action[1]

  const isPending = action[2]

  return (
    <form action={dispatch}>
      <input type="hidden" name="enrollment_id" value={props.enrollmentId} />

      <Button type="submit" size="sm" variant="secondary" disabled={isPending}>
        {isPending ? "処理中..." : "受講を完了する"}
      </Button>
    </form>
  )
}
