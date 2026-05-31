"use client"

import { useActionState } from "react"
import { toast } from "sonner"
import type { TrainingFormState } from "@/app/(app)/training/actions"
import { createTrainingEnrollmentAction } from "@/app/(app)/training/actions"
import { Button } from "@/components/ui/button"

type Props = {
  courseCode: string
}

const initialState: TrainingFormState = { ok: false, error: null }

// 研修コースの受講を申し込むボタン。course_code を hidden input で Server Action へ送る。
// 成功・失敗は action の結果を見て toast() で出す（useEffect は使わない）。
export function EnrollButton(props: Props) {
  const action = useActionState(createTrainingEnrollmentAction, initialState)

  const state = action[0]

  const dispatch = action[1]

  const isPending = action[2]

  if (state.ok) {
    toast.success("受講を申し込みました")
  } else if (state.error !== null) {
    toast.error(state.error)
  }

  return (
    <form action={dispatch}>
      <input type="hidden" name="course_code" value={props.courseCode} />

      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? "申込中..." : "受講を申し込む"}
      </Button>
    </form>
  )
}
