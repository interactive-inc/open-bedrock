"use client"

import { useActionState } from "react"
import { toast } from "sonner"
import { deleteEmployeeAction } from "@/app/(app)/employees/actions"
import type { EmployeeDeleteFormState } from "@/app/(app)/employees/actions"
import { ConfirmActionDialog } from "@/components/confirm-action-dialog"

type Props = {
  // 削除対象の従業員コード。hidden フィールドへ埋め込む。
  code: string
}

const initialState: EmployeeDeleteFormState = { ok: false, error: null }

// 従業員削除ボタン。成功時は Server Action 側で /employees へ遷移する。自分自身の削除は失敗を toast する。
export function EmployeeDeleteButton(props: Props) {
  async function reduce(
    previousState: EmployeeDeleteFormState,
    formData: FormData,
  ): Promise<EmployeeDeleteFormState> {
    const result = await deleteEmployeeAction(previousState, formData)

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
      title="この従業員を削除しますか？"
      description="関連する申請・記録も削除される取り消し不能な操作です。退職処理で代替できない場合だけ実行してください。"
      confirmLabel="従業員を削除"
      pending={isPending}
    >
      <input type="hidden" name="code" value={props.code} />
    </ConfirmActionDialog>
  )
}
