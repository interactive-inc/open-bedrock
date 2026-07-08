import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

type Props = {
  fiscalPeriodValue: string
}

// 会計期間で消化状況を絞り込む GET フォーム。summary は fiscal_period が必須。
export function BudgetSummaryFilterForm(props: Props) {
  return (
    <form method="get" action="/budgets/summary">
      <FieldSet>
        <FieldGroup className="flex-row flex-wrap items-end gap-4">
          <Field className="w-full sm:w-56">
            <FieldLabel htmlFor="budget-summary-fiscal-period">会計期間</FieldLabel>

            <Input
              id="budget-summary-fiscal-period"
              name="fiscal_period"
              defaultValue={props.fiscalPeriodValue}
              placeholder="2026 や 2026-05 など"
            />
          </Field>

          <Button type="submit">表示</Button>
        </FieldGroup>
      </FieldSet>
    </form>
  )
}
