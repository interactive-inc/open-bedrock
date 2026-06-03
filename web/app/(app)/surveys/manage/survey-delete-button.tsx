"use client"

import { useActionState } from "react"
import { toast } from "sonner"
import { deleteSurveyAction } from "@/app/(app)/surveys/manage/actions"
import type { SurveyFormState } from "@/app/(app)/surveys/manage/actions"
import { Button } from "@/components/ui/button"

type Props = {
  // 削除対象のアンケート id。hidden フィールドへ埋め込む。
  id: number
}

const initialState: SurveyFormState = { ok: false, error: null }

// アンケート削除ボタン。成功時は Server Action 側で /surveys/manage へ遷移する。
export function SurveyDeleteButton(props: Props) {
  const action = useActionState(deleteSurveyAction, initialState)

  const dispatch = action[1]

  const isPending = action[2]

  // form action に渡すラッパ。失敗時のみ toast する（成功時は遷移するため戻らない）。
  async function handleAction(formData: FormData): Promise<void> {
    const result = await deleteSurveyAction(initialState, formData)

    if (result.error !== null) {
      toast.error(result.error)
    }

    dispatch(formData)
  }

  return (
    <form action={handleAction}>
      <input type="hidden" name="id" value={props.id} />

      <Button type="submit" variant="destructive" size="sm" disabled={isPending}>
        削除
      </Button>
    </form>
  )
}
