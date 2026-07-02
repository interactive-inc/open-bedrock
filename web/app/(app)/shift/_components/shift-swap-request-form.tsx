"use client"

import { useActionState } from "react"
import { toast } from "sonner"
import type { ShiftFormState } from "@/app/(app)/shift/actions"
import { createShiftSwapRequestAction } from "@/app/(app)/shift/actions"
import { EmployeeSelect } from "@/components/employee-select"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

const initialState: ShiftFormState = { ok: false, error: null }

type Props = {
  employees: ReadonlyArray<{ code: string; name: string }>
}

// シフト交代の申請フォーム（本人向け）。交代相手・対象日・備考を native form で送る。
// 成功・失敗は action の結果を見て toast() で出す（useEffect は使わない）。
export function ShiftSwapRequestForm(props: Props) {
  // action 実行時（送信時）に結果を見て toast する。レンダー中には副作用を起こさない。
  const action = useActionState(async (previousState: ShiftFormState, formData: FormData) => {
    const next = await createShiftSwapRequestAction(previousState, formData)

    if (next.ok) {
      toast.success("交代申請を作成しました")
    } else if (next.error !== null) {
      toast.error(next.error)
    }

    return next
  }, initialState)

  const state = action[0]

  const dispatch = action[1]

  const isPending = action[2]

  return (
    <form action={dispatch}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="swap-target-code">交代相手</FieldLabel>

          <EmployeeSelect
            id="swap-target-code"
            name="target_employee_code"
            employees={props.employees}
            required
          />
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
