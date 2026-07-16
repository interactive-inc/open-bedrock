"use client"

import { FieldError } from "@/components/ui/field"
import { removeSkillAction } from "@/app/(app)/skills/me/actions"
import { useFormAction } from "@/hooks/use-form-action"
import { ConfirmActionDialog } from "@/components/confirm-action-dialog"

type Props = {
  skillCode: string
}

// 登録スキルの削除ボタン。Server Action を呼び、成功時は一覧が revalidate される。
export function RemoveSkillButton(props: Props) {
  const [state, formAction, pending] = useFormAction(
    removeSkillAction,
    {
      ok: false,
      error: null,
    },
    "スキルを削除しました",
  )

  return (
    <div>
      <ConfirmActionDialog
        action={formAction}
        triggerLabel="削除"
        title="このスキルを削除しますか？"
        description="自分のスキル一覧から削除されます。必要なら後で再登録できます。"
        confirmLabel="スキルを削除"
        pending={pending}
      >
        <input type="hidden" name="skill_code" value={props.skillCode} />
      </ConfirmActionDialog>

      {state.error === null ? null : <FieldError>{state.error}</FieldError>}
    </div>
  )
}
