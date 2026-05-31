"use client"

import { useActionState } from "react"
import { toast } from "sonner"
import type { TrainingFormState } from "@/app/(app)/training/actions"
import { completeTrainingEnrollmentAction } from "@/app/(app)/training/actions"
import { Button } from "@/components/ui/button"

type Props = {
  enrollmentId: number
}

const initialState: TrainingFormState = { ok: false, error: null }

// 受講を完了にするボタン。enrollment_id を hidden input で Server Action へ送る。
// 成功・失敗は action の結果を見て toast() で出す（useEffect は使わない）。
export function CompleteEnrollmentButton(props: Props) {
  const action = useActionState(completeTrainingEnrollmentAction, initialState)

  const state = action[0]

  const dispatch = action[1]

  const isPending = action[2]

  if (state.ok) {
    toast.success("受講を完了しました")
  } else if (state.error !== null) {
    toast.error(state.error)
  }

  return (
    <form action={dispatch}>
      <input type="hidden" name="enrollment_id" value={props.enrollmentId} />

      <Button type="submit" size="sm" variant="outline" disabled={isPending}>
        {isPending ? "処理中..." : "受講を完了する"}
      </Button>
    </form>
  )
}
