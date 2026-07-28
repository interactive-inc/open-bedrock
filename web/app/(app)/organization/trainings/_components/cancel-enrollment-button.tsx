"use client"

import { useActionState } from "react"
import { toast } from "sonner"
import type { TrainingFormState } from "@/app/(app)/organization/trainings/actions"
import { cancelTrainingEnrollmentAction } from "@/app/(app)/organization/trainings/actions"
import { Button } from "@/components/ui/button"

type Props = {
  enrollmentId: number
}

const initialState: TrainingFormState = { ok: false, error: null }

/**
 * 受講を取り消すボタン。enrollment_id を hidden input で Server Action へ送る。
 * 成功・失敗は action の結果を見て toast() で出す（useEffect は使わない）。
 */
export function CancelEnrollmentButton(props: Props) {
  const action = useActionState(async (previousState: TrainingFormState, formData: FormData) => {
    const next = await cancelTrainingEnrollmentAction(previousState, formData)

    if (next.ok) {
      toast.success("受講を取り消しました")
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

      <Button type="submit" size="sm" variant="ghost" disabled={isPending}>
        {isPending ? "処理中..." : "取り消す"}
      </Button>
    </form>
  )
}
