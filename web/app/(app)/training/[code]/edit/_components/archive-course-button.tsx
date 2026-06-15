"use client"

import { useActionState } from "react"
import { toast } from "sonner"
import type { TrainingFormState } from "@/app/(app)/training/actions"
import { archiveTrainingCourseAction } from "@/app/(app)/training/actions"
import { Button } from "@/components/ui/button"

type Props = {
  code: string
}

const initialState: TrainingFormState = { ok: false, error: null }

/**
 * 研修コースをアーカイブするボタン。成功時は detail/edit が revalidate される。
 */
export function ArchiveCourseButton(props: Props) {
  const action = useActionState(async (previousState: TrainingFormState, formData: FormData) => {
    const next = await archiveTrainingCourseAction(previousState, formData)

    if (next.ok) {
      toast.success("コースをアーカイブしました")
    } else if (next.error !== null) {
      toast.error(next.error)
    }

    return next
  }, initialState)

  const dispatch = action[1]

  const isPending = action[2]

  return (
    <form action={dispatch}>
      <input type="hidden" name="code" value={props.code} />

      <Button type="submit" variant="destructive" disabled={isPending}>
        {isPending ? "処理中..." : "アーカイブ"}
      </Button>
    </form>
  )
}
