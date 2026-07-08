"use client"

import { useActionState } from "react"
import { toast } from "sonner"
import { deleteBudgetAction } from "@/app/(app)/budgets/actions"
import type { BudgetDeleteFormState } from "@/app/(app)/budgets/actions"
import { Button } from "@/components/ui/button"

type Props = {
  // 削除対象の予算 ID。hidden フィールドへ埋め込む。
  budgetId: number
}

const initialState: BudgetDeleteFormState = { ok: false, error: null }

// 予算削除ボタン。成功時は Server Action 側で /budgets へ遷移する。失敗は toast する。
export function BudgetDeleteButton(props: Props) {
  async function reduce(
    previousState: BudgetDeleteFormState,
    formData: FormData,
  ): Promise<BudgetDeleteFormState> {
    const result = await deleteBudgetAction(previousState, formData)

    if (result.error !== null) {
      toast.error(result.error)
    }

    return result
  }

  const action = useActionState(reduce, initialState)

  const formAction = action[1]

  const isPending = action[2]

  return (
    <form action={formAction}>
      <input type="hidden" name="budget_id" value={props.budgetId} />

      <Button type="submit" variant="destructive" size="sm" disabled={isPending}>
        削除
      </Button>
    </form>
  )
}
