"use client"

import { useRouter } from "next/navigation"
import { useActionState } from "react"
import { toast } from "sonner"
import { deleteSurveyAction } from "@/app/(app)/organization/surveys/manage/actions"
import type { SurveyFormState } from "@/app/(app)/organization/surveys/manage/actions"
import { ConfirmActionDialog } from "@/components/confirm-action-dialog"

type Props = {
  // 削除対象のアンケート id。hidden フィールドへ埋め込む。
  id: number
}

const initialState: SurveyFormState = { ok: false, error: null }

// アンケート削除ボタン。成功・失敗の通知は action の結果を見て toast() で出す。成功時は一覧へ遷移する。
export function SurveyDeleteButton(props: Props) {
  const router = useRouter()

  async function reduce(
    previousState: SurveyFormState,
    formData: FormData,
  ): Promise<SurveyFormState> {
    const result = await deleteSurveyAction(previousState, formData)

    if (result.ok) {
      toast.success("アンケートを削除しました")

      router.push("/organization/surveys/manage")
    } else if (result.error !== null) {
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
