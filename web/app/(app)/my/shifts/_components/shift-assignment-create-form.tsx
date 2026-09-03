"use client"

import { useRouter } from "next/navigation"
import { useActionState } from "react"
import { toast } from "sonner"
import type { ShiftFormState } from "@/app/(app)/my/shifts/actions"
import { createShiftAssignmentAction } from "@/app/(app)/my/shifts/actions"
import { EmployeeSelect } from "@/components/employee-select"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

const initialState: ShiftFormState = { ok: false, error: null }

type Props = {
  employees: ReadonlyArray<{ code: string; name: string }>
}

/**
 * シフト割当の作成フォーム（特権ロール向け）。対象社員・パターンコード・対象日・備考を送る。
 * 成功・失敗の通知は action の結果を見て toast() で出す。成功時は /shift/manage へ遷移する。
 */
export function ShiftAssignmentCreateForm(props: Props) {
  const router = useRouter()

  const action = useActionState(async (previousState: ShiftFormState, formData: FormData) => {
    const next = await createShiftAssignmentAction(previousState, formData)

    if (next.ok) {
      toast.success("シフトを割り当てました")

      router.push("/shift/shift-assignments")
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
          <FieldLabel htmlFor="assignment-employee-code">対象社員</FieldLabel>

          <EmployeeSelect
            id="assignment-employee-code"
            name="employee_code"
            employees={props.employees}
            required
          />
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
