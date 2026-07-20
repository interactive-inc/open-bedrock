"use client"

import { useRouter } from "next/navigation"
import { useActionState } from "react"
import { toast } from "sonner"
import { createBudgetAction } from "@/app/(app)/organization/budgets/actions"
import type { BudgetCreateFormState } from "@/app/(app)/organization/budgets/actions"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

const initialState: BudgetCreateFormState = { ok: false, error: null }

/**
 * 予算登録フォーム。部署・会計期間・期間・金額・名称・任意メモを native form で送る。
 * 成功・失敗の通知は action の結果を見て toast() で出す（useEffect は使わない）。
 * 成功時は予算一覧へ遷移する。
 */
export function BudgetCreateForm() {
  const router = useRouter()

  async function reduce(
    previousState: BudgetCreateFormState,
    formData: FormData,
  ): Promise<BudgetCreateFormState> {
    const result = await createBudgetAction(previousState, formData)

    if (result.ok) {
      toast.success("予算を登録しました")

      router.push("/organization/budgets")
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
          <FieldLabel htmlFor="budget-department-id">部署 ID</FieldLabel>

          <Input
            id="budget-department-id"
            name="department_id"
            type="number"
            min={1}
            step={1}
            placeholder="3"
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="budget-fiscal-period">会計期間</FieldLabel>

          <Input
            id="budget-fiscal-period"
            name="fiscal_period"
            placeholder="2026 や 2026-05 など"
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="budget-period-start">期間開始日</FieldLabel>

          <Input id="budget-period-start" name="period_start" type="date" required />
        </Field>

        <Field>
          <FieldLabel htmlFor="budget-period-end">期間終了日</FieldLabel>

          <Input id="budget-period-end" name="period_end" type="date" required />
        </Field>

        <Field>
          <FieldLabel htmlFor="budget-amount">予算額（円）</FieldLabel>

          <Input
            id="budget-amount"
            name="amount"
            type="number"
            min={1}
            step={1}
            placeholder="1000000"
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="budget-name">名称</FieldLabel>

          <Input id="budget-name" name="name" placeholder="エンジニアリング 2026 年度" required />
        </Field>

        <Field>
          <FieldLabel htmlFor="budget-note">メモ（任意）</FieldLabel>

          <Textarea id="budget-note" name="note" rows={3} placeholder="用途や内訳など" />
        </Field>

        {state.error !== null ? <FieldError>{state.error}</FieldError> : null}

        <Field orientation="horizontal">
          <Button type="submit" disabled={isPending}>
            {isPending ? "登録中..." : "予算を登録"}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
