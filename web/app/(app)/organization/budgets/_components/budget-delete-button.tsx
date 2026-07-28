"use client"

import { useRouter } from "next/navigation"
import { useActionState } from "react"
import { toast } from "sonner"
import { deleteBudgetAction } from "@/app/(app)/organization/budgets/actions"
import type { BudgetDeleteFormState } from "@/app/(app)/organization/budgets/actions"
import { ConfirmActionDialog } from "@/components/confirm-action-dialog"

type Props = {
  // 削除対象の予算 ID。hidden フィールドへ埋め込む。
  budgetId: number
}

const initialState: BudgetDeleteFormState = { ok: false, error: null }

/** 予算削除ボタン。成功・失敗の通知は action の結果を見て toast() で出す。成功時は一覧へ遷移する。 */
export function BudgetDeleteButton(props: Props) {
  const router = useRouter()

  async function reduce(
    previousState: BudgetDeleteFormState,
    formData: FormData,
  ): Promise<BudgetDeleteFormState> {
    const result = await deleteBudgetAction(previousState, formData)

    if (result.ok) {
      toast.success("予算を削除しました")

      router.push("/organization/budgets")
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
      title="この予算を削除しますか？"
      description="予算の記録は元に戻せません。承認済み経費の記録は削除されません。"
      confirmLabel="予算を削除"
      pending={isPending}
    >
      <input type="hidden" name="budget_id" value={props.budgetId} />
    </ConfirmActionDialog>
  )
}
