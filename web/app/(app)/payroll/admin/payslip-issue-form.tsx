"use client"

import { useActionState } from "react"
import { toast } from "sonner"
import { issuePayslipAction } from "@/app/(app)/payroll/admin/actions"
import type { PayrollAdminFormState } from "@/app/(app)/payroll/admin/actions"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

const initialState: PayrollAdminFormState = { ok: false, error: null }

// 給与明細の発行フォーム。社員コード・対象期間・基本給・手当・控除を native form で送る。
// 成功・失敗の通知は action の結果を見て toast() で出す（useEffect は使わない）。
export function PayslipIssueForm() {
  // action 実行時（送信時）に結果を見て toast する。レンダー中には副作用を起こさない。
  const action = useActionState(
    async (previousState: PayrollAdminFormState, formData: FormData) => {
      const next = await issuePayslipAction(previousState, formData)

      if (next.ok) {
        toast.success("給与明細を発行しました")
      } else if (next.error !== null) {
        toast.error(next.error)
      }

      return next
    },
    initialState,
  )

  const state = action[0]

  const dispatch = action[1]

  const isPending = action[2]

  return (
    <form action={dispatch}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="payslip-employee-code">社員コード</FieldLabel>

          <Input id="payslip-employee-code" name="employee_code" placeholder="E0001" required />
        </Field>

        <Field>
          <FieldLabel htmlFor="payslip-period">対象期間</FieldLabel>

          <Input id="payslip-period" name="period" placeholder="2026-05" required />
        </Field>

        <Field>
          <FieldLabel htmlFor="payslip-base-salary">基本給（円）</FieldLabel>

          <Input
            id="payslip-base-salary"
            name="base_salary"
            type="number"
            min={0}
            step={1}
            placeholder="300000"
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="payslip-allowances">手当（円）</FieldLabel>

          <Input
            id="payslip-allowances"
            name="allowances"
            type="number"
            min={0}
            step={1}
            placeholder="0"
            defaultValue={0}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="payslip-deductions">控除（円）</FieldLabel>

          <Input
            id="payslip-deductions"
            name="deductions"
            type="number"
            min={0}
            step={1}
            placeholder="0"
            defaultValue={0}
          />
        </Field>

        {state.error !== null ? <FieldError>{state.error}</FieldError> : null}

        <Field orientation="horizontal">
          <Button type="submit" disabled={isPending}>
            {isPending ? "発行中..." : "給与明細を発行"}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
