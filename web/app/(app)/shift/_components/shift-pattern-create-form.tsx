"use client"

import { useActionState } from "react"
import { toast } from "sonner"
import type { ShiftFormState } from "@/app/(app)/shift/actions"
import { createShiftPatternAction } from "@/app/(app)/shift/actions"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

const initialState: ShiftFormState = { ok: false, error: null }

// シフトパターンの作成フォーム（特権ロール向け）。コード・名前・開始/終了時刻・休憩時間を送る。
// 成功時は action が /shift/patterns へ redirect するため、toast は失敗時のみ出す。
export function ShiftPatternCreateForm() {
  const action = useActionState(async (previousState: ShiftFormState, formData: FormData) => {
    const next = await createShiftPatternAction(previousState, formData)

    if (next.error !== null) {
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
          <FieldLabel htmlFor="pattern-code">コード</FieldLabel>

          <Input id="pattern-code" name="code" placeholder="EARLY" required />
        </Field>

        <Field>
          <FieldLabel htmlFor="pattern-name">名前</FieldLabel>

          <Input id="pattern-name" name="name" placeholder="早番" required />
        </Field>

        <Field>
          <FieldLabel htmlFor="pattern-start-time">開始時刻</FieldLabel>

          <Input id="pattern-start-time" name="start_time" type="time" required />
        </Field>

        <Field>
          <FieldLabel htmlFor="pattern-end-time">終了時刻</FieldLabel>

          <Input id="pattern-end-time" name="end_time" type="time" required />
        </Field>

        <Field>
          <FieldLabel htmlFor="pattern-break-minutes">休憩時間（分）</FieldLabel>

          <Input id="pattern-break-minutes" name="break_minutes" type="number" placeholder="60" />
        </Field>

        {state.error !== null ? <FieldError>{state.error}</FieldError> : null}

        <Field orientation="horizontal">
          <Button type="submit" disabled={isPending}>
            {isPending ? "作成中..." : "パターンを作成"}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
