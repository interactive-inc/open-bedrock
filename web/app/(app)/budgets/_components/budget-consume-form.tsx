"use client"

import { useActionState } from "react"
import { toast } from "sonner"
import { recordBudgetConsumptionAction } from "@/app/(app)/budgets/actions"
import type { BudgetActionState } from "@/app/(app)/budgets/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const initialState: BudgetActionState = { ok: false, error: null }

type Props = {
  budgetId: number
}

/**
 * 予算枠の消化を手動記録する行内フォーム。budget id は hidden input で渡す。
 * 金額と記録日を入力して Server Action を form action で呼ぶ。
 */
export function BudgetConsumeForm(props: Props) {
  async function reduce(
    previousState: BudgetActionState,
    formData: FormData,
  ): Promise<BudgetActionState> {
    const result = await recordBudgetConsumptionAction(previousState, formData)

    if (result.ok) {
      toast.success("消化を記録しました")
    } else if (result.error !== null) {
      toast.error(result.error)
    }

    return result
  }

  const action = useActionState(reduce, initialState)

  const formAction = action[1]

  const pending = action[2]

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="budget_id" value={props.budgetId} />

      <Input
        name="amount"
        type="number"
        min="0"
        placeholder="金額"
        aria-label="消化金額"
        className="w-28"
        required
      />

      <Input name="recorded_on" type="date" aria-label="記録日" className="w-40" required />

      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? "記録中..." : "消化を記録"}
      </Button>
    </form>
  )
}
