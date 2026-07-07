"use client"

import { useRouter } from "next/navigation"
import { useActionState } from "react"
import { toast } from "sonner"
import { createBudgetAction } from "@/app/(app)/budgets/actions"
import type { BudgetActionState } from "@/app/(app)/budgets/actions"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

const initialState: BudgetActionState = { ok: false, error: null }

// 予算枠の作成フォーム。会計年度・表題・金額が必須。成功時は /budgets へ戻る。
export function BudgetCreateForm() {
  const router = useRouter()

  async function reduce(
    previousState: BudgetActionState,
    formData: FormData,
  ): Promise<BudgetActionState> {
    const result = await createBudgetAction(previousState, formData)

    if (result.ok) {
      toast.success("予算枠を作成しました")

      router.push("/budgets")
    } else if (result.error !== null) {
      toast.error(result.error)
    }

    return result
  }

  const action = useActionState(reduce, initialState)

  const state = action[0]

  const formAction = action[1]

  const isPending = action[2]

  return (
    <form action={formAction}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="budget-fiscal-year">会計年度</FieldLabel>

          <Input
            id="budget-fiscal-year"
            name="fiscal_year"
            type="number"
            placeholder="2026"
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="budget-department-code">部署コード（任意）</FieldLabel>

          <Input id="budget-department-code" name="department_code" />
        </Field>

        <Field>
          <FieldLabel htmlFor="budget-title">表題</FieldLabel>

          <Input id="budget-title" name="title" required />
        </Field>

        <Field>
          <FieldLabel htmlFor="budget-amount">金額（円）</FieldLabel>

          <Input id="budget-amount" name="amount" type="number" min="0" required />
        </Field>

        <Field>
          <FieldLabel htmlFor="budget-note">備考（任意）</FieldLabel>

          <Input id="budget-note" name="note" />
        </Field>

        {state.error !== null ? <FieldError>{state.error}</FieldError> : null}

        <Field orientation="horizontal">
          <Button type="submit" disabled={isPending}>
            {isPending ? "作成中..." : "予算枠を作成"}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
