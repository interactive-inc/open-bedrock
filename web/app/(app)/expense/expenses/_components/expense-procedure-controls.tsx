import { ExpenseProcedureActionForm } from "@/app/(app)/my/expenses/_components/expense-procedure-action-form"
import { ExpenseDecisionForm } from "@/app/(app)/my/expenses/_components/expense-decision-form"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import type { ExpenseDecisionTarget } from "@/lib/api/types/expense-types"
type Props = {
  expense: {
    id: number
    decision_target: ExpenseDecisionTarget | null
    can_decide: boolean
    can_execute: boolean
    can_cancel: boolean
  }
}

/** APIで解決した現在の操作資格と表示対象から判断・取消・確定を描画する。 */
export function ExpenseProcedureControls({ expense }: Props) {
  return (
    <>
      {" "}
      {expense.decision_target !== null && expense.can_decide ? (
        <Card>
          <CardHeader>
            <CardTitle>承認・否認</CardTitle>
          </CardHeader>
          <CardContent>
            <ExpenseDecisionForm expenseId={expense.id} decisionTarget={expense.decision_target} />
          </CardContent>
        </Card>
      ) : null}
      {expense.decision_target !== null && expense.can_execute ? (
        <ExpenseProcedureActionForm
          expenseId={expense.id}
          decisionTarget={expense.decision_target}
          operation="execute"
        />
      ) : null}
      {expense.decision_target !== null && expense.can_cancel ? (
        <ExpenseProcedureActionForm
          expenseId={expense.id}
          decisionTarget={expense.decision_target}
          operation="cancel"
        />
      ) : null}
    </>
  )
}
