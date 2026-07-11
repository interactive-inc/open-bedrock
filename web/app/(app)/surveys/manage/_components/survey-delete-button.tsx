"use client"

import { useActionState } from "react"
import { toast } from "sonner"
import { deleteSurveyAction } from "@/app/(app)/surveys/manage/actions"
import type { SurveyFormState } from "@/app/(app)/surveys/manage/actions"
import { ConfirmActionDialog } from "@/components/confirm-action-dialog"

type Props = {
  // 削除対象のアンケート id。hidden フィールドへ埋め込む。
  id: number
}

const initialState: SurveyFormState = { ok: false, error: null }

// アンケート削除ボタン。成功時は Server Action 側で /surveys/manage へ遷移する。
export function SurveyDeleteButton(props: Props) {
  async function reduce(
    previousState: SurveyFormState,
    formData: FormData,
  ): Promise<SurveyFormState> {
    const result = await deleteSurveyAction(previousState, formData)

    if (result.error !== null) {
      toast.error(result.error)
    }

    return result
  }

  const action = useActionState(reduce, initialState)

  const formAction = action[1]

  const isPending = action[2]

  return (
    <ConfirmActionDialog
      action={formAction}
      triggerLabel="削除"
      title="このアンケートを削除しますか？"
      description="設問と収集済みの回答を含め、アンケートの記録は元に戻せません。"
      confirmLabel="アンケートを削除"
      pending={isPending}
    >
      <input type="hidden" name="id" value={props.id} />
    </ConfirmActionDialog>
  )
}
