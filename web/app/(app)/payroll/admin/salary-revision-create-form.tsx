"use client"

import { useActionState } from "react"
import { toast } from "sonner"
import { createSalaryRevisionAction } from "@/app/(app)/payroll/admin/actions"
import type { PayrollAdminFormState } from "@/app/(app)/payroll/admin/actions"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

const initialState: PayrollAdminFormState = { ok: false, error: null }

// 給与改定の作成フォーム。社員コード・適用日・改定後基本給・任意の理由を native form で送る。
// 成功・失敗の通知は action の結果を見て toast() で出す（useEffect は使わない）。
export function SalaryRevisionCreateForm() {
  const action = useActionState(createSalaryRevisionAction, initialState)

  const state = action[0]

  const dispatch = action[1]

  const isPending = action[2]

  // 直前の送信結果を描画時に通知する。state が変わるたびに評価される。
  if (state.ok) {
    toast.success("給与改定を作成しました")
  } else if (state.error !== null) {
    toast.error(state.error)
  }

  return (
    <form action={dispatch}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="revision-employee-code">社員コード</FieldLabel>

          <Input id="revision-employee-code" name="employee_code" placeholder="E0001" required />
        </Field>

        <Field>
          <FieldLabel htmlFor="revision-effective-date">適用日</FieldLabel>

          <Input id="revision-effective-date" name="effective_date" type="date" required />
        </Field>

        <Field>
          <FieldLabel htmlFor="revision-new-base-salary">改定後基本給（円）</FieldLabel>

          <Input
            id="revision-new-base-salary"
            name="new_base_salary"
            type="number"
            min={0}
            step={1}
            placeholder="320000"
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="revision-reason">理由（任意）</FieldLabel>

          <Textarea id="revision-reason" name="reason" rows={3} placeholder="昇給・等級改定など" />
        </Field>

        {state.error !== null ? <FieldError>{state.error}</FieldError> : null}

        <Field orientation="horizontal">
          <Button type="submit" disabled={isPending}>
            {isPending ? "作成中..." : "給与改定を作成"}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
