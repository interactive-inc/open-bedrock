"use client"

import { useActionState } from "react"
import { toast } from "sonner"
import type { ShiftFormState } from "@/app/(app)/shift/actions"
import { createShiftSwapRequestAction } from "@/app/(app)/shift/actions"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

const initialState: ShiftFormState = { ok: false, error: null }

// シフト交代の申請フォーム（本人向け）。交代相手の社員コード・対象日・備考を native form で送る。
// 成功・失敗は action の結果を見て toast() で出す（useEffect は使わない）。
export function ShiftSwapRequestForm() {
  const action = useActionState(createShiftSwapRequestAction, initialState)

  const state = action[0]

  const dispatch = action[1]

  const isPending = action[2]

  if (state.ok) {
    toast.success("交代申請を作成しました")
  } else if (state.error !== null) {
    toast.error(state.error)
  }

  return (
    <form action={dispatch}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="swap-target-code">交代相手の社員コード</FieldLabel>

          <Input id="swap-target-code" name="target_employee_code" placeholder="E0001" required />
        </Field>

        <Field>
          <FieldLabel htmlFor="swap-date">対象日</FieldLabel>

          <Input id="swap-date" name="date" type="date" required />
        </Field>

        <Field>
          <FieldLabel htmlFor="swap-note">備考</FieldLabel>

          <Textarea id="swap-note" name="note" placeholder="交代理由などを入力" />
        </Field>

        {state.error !== null ? <FieldError>{state.error}</FieldError> : null}

        <Field orientation="horizontal">
          <Button type="submit" disabled={isPending}>
            {isPending ? "申請中..." : "交代を申請"}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
