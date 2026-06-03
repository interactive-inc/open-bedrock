"use client"

import { useActionState } from "react"
import { toast } from "sonner"
import { createYearEndAdjustmentAction } from "@/app/(app)/year-end-adjustments/actions"
import type { YearEndAdjustmentActionState } from "@/app/(app)/year-end-adjustments/actions"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

const initialState: YearEndAdjustmentActionState = { ok: false, error: null }

// 年末調整申告フォーム。native form + Server Action を useActionState で呼び、結果を sonner で通知する。
// reducer 内で Server Action を 1 回だけ実行し、その結果で toast() する（useEffect は使わない）。
export function YearEndAdjustmentCreateForm() {
  // useActionState の reducer。Server Action を実行し結果をそのまま次の state にする。
  async function reduce(
    previousState: YearEndAdjustmentActionState,
    formData: FormData,
  ): Promise<YearEndAdjustmentActionState> {
    const result = await createYearEndAdjustmentAction(previousState, formData)

    if (result.ok) {
      toast.success("年末調整を申告しました")
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
      <h2 className="text-lg font-medium">年末調整を申告</h2>

      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="adjustment-year">対象年</FieldLabel>

          <Input id="adjustment-year" name="target_year" type="number" min="2000" required />
        </Field>

        <Field>
          <FieldLabel htmlFor="adjustment-note">備考</FieldLabel>

          <Input id="adjustment-note" name="note" placeholder="任意" />
        </Field>
      </FieldGroup>

      <FieldDescription>備考は任意です。税額の計算や判定は行わず記録のみです</FieldDescription>

      {state.error !== null ? <FieldError>{state.error}</FieldError> : null}

      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "申告中..." : "申告する"}
        </Button>
      </div>
    </form>
  )
}
