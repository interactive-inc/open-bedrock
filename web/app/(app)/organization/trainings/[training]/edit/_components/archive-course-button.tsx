"use client"

import { useActionState } from "react"
import { toast } from "sonner"
import type { TrainingFormState } from "@/app/(app)/organization/trainings/actions"
import { archiveTrainingCourseAction } from "@/app/(app)/organization/trainings/actions"
import { ConfirmActionDialog } from "@/components/confirm-action-dialog"

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
    <ConfirmActionDialog
      action={dispatch}
      triggerLabel={isPending ? "処理中…" : "アーカイブ"}
      title="このコースをアーカイブしますか？"
      description="新しい受講登録ができなくなります。既存の受講履歴は保持されます。"
      confirmLabel="アーカイブする"
      pending={isPending}
      size="default"
    >
      <input type="hidden" name="code" value={props.code} />
    </ConfirmActionDialog>
  )
}
