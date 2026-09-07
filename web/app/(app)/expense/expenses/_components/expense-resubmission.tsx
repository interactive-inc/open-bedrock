import { ExpenseCreateForm } from "@/app/(app)/my/expenses/_components/expense-create-form"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import type { ExpenseDetailResponse } from "@/lib/api/types/expense-types"
type Props = {
  expense: ExpenseDetailResponse & { can_submit_legacy: boolean; can_resubmit: boolean }
  requestKey: string
}

/** 既存経費の接続または差戻し後の再提出を、元の内容から開始する。 */
export function ExpenseResubmission({ expense, requestKey }: Props) {
  return (
    <>
      {" "}
      {expense.can_submit_legacy || expense.can_resubmit ? (
        <Card>
          <CardHeader>
            <CardTitle>
              {expense.can_resubmit ? "修正して再提出" : "内容を確認して承認規程へ接続"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ExpenseCreateForm
              requestKey={requestKey}
              initial={expense}
              mode={expense.can_resubmit ? "resubmit" : "adopt"}
            />
          </CardContent>
        </Card>
      ) : null}
    </>
  )
}
