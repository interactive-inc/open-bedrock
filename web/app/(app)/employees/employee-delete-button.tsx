"use client"

import { useActionState } from "react"
import { toast } from "sonner"
import { deleteEmployeeAction } from "@/app/(app)/employees/actions"
import type { EmployeeDeleteFormState } from "@/app/(app)/employees/actions"
import { Button } from "@/components/ui/button"

type Props = {
  // 削除対象の従業員コード。hidden フィールドへ埋め込む。
  code: string
}

const initialState: EmployeeDeleteFormState = { ok: false, error: null }

// 従業員削除ボタン。成功時は Server Action 側で /employees へ遷移する。自分自身の削除は失敗を toast する。
export function EmployeeDeleteButton(props: Props) {
  const action = useActionState(deleteEmployeeAction, initialState)

  const dispatch = action[1]

  const isPending = action[2]

  // form action に渡すラッパ。失敗時のみ toast する（成功時は遷移するため戻らない）。
  async function handleAction(formData: FormData): Promise<void> {
    const result = await deleteEmployeeAction(initialState, formData)

    if (result.error !== null) {
      toast.error(result.error)
    }

    dispatch(formData)
  }

  return (
    <form action={handleAction}>
      <input type="hidden" name="code" value={props.code} />

      <Button type="submit" variant="destructive" size="sm" disabled={isPending}>
        削除
      </Button>
    </form>
  )
}
