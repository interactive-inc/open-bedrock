"use client"

import { useActionState } from "react"
import { toast } from "sonner"
import { createRewardAction } from "@/app/(app)/thanks/actions"
import type { ThanksActionState } from "@/app/(app)/thanks/actions"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

const initialState: ThanksActionState = { ok: false, error: null }

// 景品登録フォーム（管理権限向け）。名前・交換コスト・在庫を native form で送る。
// reducer 内で結果に応じて toast() する（useEffect は使わない）。
export function RewardCreateForm() {
  async function reduce(
    previousState: ThanksActionState,
    formData: FormData,
  ): Promise<ThanksActionState> {
    const result = await createRewardAction(previousState, formData)

    if (result.ok) {
      toast.success("景品を登録しました")
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
    <form action={formAction} className="flex flex-col gap-4 rounded-2xl border p-4">
      <h3 className="text-base font-medium">景品を登録する</h3>

      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="reward-name">景品名</FieldLabel>

          <Input
            id="reward-name"
            name="name"
            placeholder="図書カード"
            disabled={isPending}
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="reward-cost">交換コスト（pt）</FieldLabel>

          <Input
            id="reward-cost"
            name="point_cost"
            type="number"
            min={1}
            step={1}
            placeholder="100"
            disabled={isPending}
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="reward-stock">在庫（任意）</FieldLabel>

          <Input
            id="reward-stock"
            name="stock"
            type="number"
            min={0}
            step={1}
            placeholder="空欄で在庫無制限"
            disabled={isPending}
          />

          <FieldDescription>
            空欄なら在庫無制限。数値を入れると在庫数で管理します。
          </FieldDescription>
        </Field>

        {state.error !== null ? <FieldError>{state.error}</FieldError> : null}

        <Field orientation="horizontal">
          <Button type="submit" disabled={isPending}>
            {isPending ? "登録中..." : "登録"}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
