"use client"

import { useActionState, useState } from "react"
import { toast } from "sonner"
import { updateBudgetAction } from "@/app/(app)/expense/budgets/actions"
import type { BudgetUpdateFormState } from "@/app/(app)/expense/budgets/actions"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

type Props = {
  // 編集対象の予算。hidden の budget_id と各入力の初期値に使う。
  budgetId: number
  amount: number
  name: string
  note: string | null
}

const initialState: BudgetUpdateFormState = { ok: false, error: null }

/**
 * 予算編集フォームを Dialog で開く。金額・名称・メモを変更して送信する。部署・会計期間は変更しない。
 * 成功・失敗の通知は action の結果を見て toast() で出す（useEffect は使わない）。
 */
export function BudgetEditForm(props: Props) {
  const [open, setOpen] = useState(false)

  async function reduce(
    previousState: BudgetUpdateFormState,
    formData: FormData,
  ): Promise<BudgetUpdateFormState> {
    const result = await updateBudgetAction(previousState, formData)

    if (result.ok) {
      toast.success("予算を更新しました")

      setOpen(false)
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>編集</DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>予算を編集</DialogTitle>

          <DialogDescription>金額・名称・メモを変更します。</DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="budget_id" value={props.budgetId} />

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="edit-budget-amount">予算額（円）</FieldLabel>

              <Input
                id="edit-budget-amount"
                name="amount"
                type="number"
                min={1}
                step={1}
                defaultValue={props.amount}
                required
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="edit-budget-name">名称</FieldLabel>

              <Input id="edit-budget-name" name="name" defaultValue={props.name} required />
            </Field>

            <Field>
              <FieldLabel htmlFor="edit-budget-note">メモ（任意）</FieldLabel>

              <Textarea
                id="edit-budget-note"
                name="note"
                rows={3}
                defaultValue={props.note ?? ""}
              />
            </Field>

            {state.error !== null ? <FieldError>{state.error}</FieldError> : null}

            <Field orientation="horizontal">
              <Button type="submit" disabled={isPending}>
                {isPending ? "更新中..." : "更新"}
              </Button>
            </Field>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  )
}
