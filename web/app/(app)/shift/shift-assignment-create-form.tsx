"use client"

import { useActionState } from "react"
import { toast } from "sonner"
import type { ShiftFormState } from "@/app/(app)/shift/actions"
import { createShiftAssignmentAction } from "@/app/(app)/shift/actions"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

const initialState: ShiftFormState = { ok: false, error: null }

// シフト割当の作成フォーム（特権ロール向け）。社員コード・パターンコード・対象日・備考を送る。
// 成功・失敗は action の結果を見て toast() で出す（useEffect は使わない）。
export function ShiftAssignmentCreateForm() {
  // action 実行時（送信時）に結果を見て toast する。レンダー中には副作用を起こさない。
  const action = useActionState(async (previousState: ShiftFormState, formData: FormData) => {
    const next = await createShiftAssignmentAction(previousState, formData)

    if (next.ok) {
      toast.success("シフトを割り当てました")
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
          <FieldLabel htmlFor="assignment-employee-code">社員コード</FieldLabel>

          <Input id="assignment-employee-code" name="employee_code" placeholder="E0001" required />
        </Field>

        <Field>
          <FieldLabel htmlFor="assignment-pattern-code">パターンコード</FieldLabel>

          <Input id="assignment-pattern-code" name="pattern_code" placeholder="EARLY" required />
        </Field>

        <Field>
          <FieldLabel htmlFor="assignment-date">対象日</FieldLabel>

          <Input id="assignment-date" name="date" type="date" required />
        </Field>

        <Field>
          <FieldLabel htmlFor="assignment-note">備考</FieldLabel>

          <Textarea id="assignment-note" name="note" placeholder="備考を入力" />
        </Field>

        {state.error !== null ? <FieldError>{state.error}</FieldError> : null}

        <Field orientation="horizontal">
          <Button type="submit" disabled={isPending}>
            {isPending ? "割当中..." : "シフトを割り当て"}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
