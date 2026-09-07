"use client"

import { useActionState } from "react"
import { advanceExpenseAction } from "@/app/(app)/my/expenses/actions"
import { Button } from "@/components/ui/button"
import { FieldError } from "@/components/ui/field"
import type { ExpenseDecisionTarget } from "@/lib/api/types/expense-types"

type Props = {
  expenseId: number
  decisionTarget: ExpenseDecisionTarget
  operation: "cancel" | "execute"
}

/** 経費の取消と確定待ちの再試行を表示する。 */
export function ExpenseProcedureActionForm(props: Props) {
  const action = useActionState(advanceExpenseAction, { ok: false, error: null })
  return (
    <form action={action[1]} className="flex flex-col gap-2">
      <input type="hidden" name="expense_id" value={props.expenseId} />
      <input type="hidden" name="decision_target" value={JSON.stringify(props.decisionTarget)} />
      <input type="hidden" name="operation" value={props.operation} />
      <Button
        type="submit"
        variant={props.operation === "cancel" ? "secondary" : "default"}
        disabled={action[2] || action[0].ok}
      >
        {action[0].ok
          ? "完了しました"
          : props.operation === "cancel"
            ? "経費を取り消す"
            : "決裁を確定する"}
      </Button>
      {action[0].error !== null ? <FieldError>{action[0].error}</FieldError> : null}
    </form>
  )
}
