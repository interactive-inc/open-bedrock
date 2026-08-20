"use client"

import { useRouter } from "next/navigation"
import { useActionState } from "react"
import { toast } from "sonner"
import { submitExpenseAction } from "@/app/(app)/my/expenses/actions"
import type { ExpenseSubmitFormState } from "@/app/(app)/my/expenses/actions"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"

const initialState: ExpenseSubmitFormState = { ok: false, error: null }

/**
 * 経費申請フォーム。カテゴリ・金額・利用日・任意メモを native form で送る。
 * 成功・失敗の通知は action の結果を見て toast() で出す（useEffect は使わない）。
 * 成功時は自分の経費一覧へ遷移し、申請がステータス付きで並んだことを見せる。
 */
export function ExpenseCreateForm() {
  const router = useRouter()

  async function reduce(
    previousState: ExpenseSubmitFormState,
    formData: FormData,
  ): Promise<ExpenseSubmitFormState> {
    const result = await submitExpenseAction(previousState, formData)

    if (result.ok) {
      toast.success("経費を申請しました")

      router.push("/my/expenses")
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
          <FieldLabel htmlFor="expense-category">カテゴリ</FieldLabel>

          <NativeSelect
            id="expense-category"
            name="category"
            defaultValue="transport"
            className="w-full"
          >
            <NativeSelectOption value="transport">交通費</NativeSelectOption>
            <NativeSelectOption value="supplies">備品</NativeSelectOption>
            <NativeSelectOption value="entertainment">交際費</NativeSelectOption>
            <NativeSelectOption value="books">書籍</NativeSelectOption>
            <NativeSelectOption value="other">その他</NativeSelectOption>
          </NativeSelect>
        </Field>

        <Field>
          <FieldLabel htmlFor="expense-amount">金額（円）</FieldLabel>

          <Input
            id="expense-amount"
            name="amount"
            type="number"
            min={1}
            step={1}
            placeholder="3000"
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="expense-spent-at">利用日</FieldLabel>

          <Input id="expense-spent-at" name="spent_at" type="date" required />
        </Field>

        <Field>
          <FieldLabel htmlFor="expense-files">領収書（任意）</FieldLabel>

          <Input
            id="expense-files"
            name="files"
            type="file"
            multiple
            accept="application/pdf,image/jpeg,image/png,image/heic"
          />

          <FieldDescription>PDF・JPEG・PNG・HEIC を 1 件 25MB まで添付できます</FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="expense-note">メモ（任意）</FieldLabel>

          <Textarea id="expense-note" name="note" rows={3} placeholder="用途や相手先など" />
        </Field>

        {state.error !== null ? <FieldError>{state.error}</FieldError> : null}

        <Field orientation="horizontal">
          <Button type="submit" disabled={isPending}>
            {isPending ? "申請中..." : "経費を申請"}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
