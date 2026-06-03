"use client"

import { useActionState } from "react"
import { toast } from "sonner"
import { cancelPayslipAction, correctPayslipAction } from "@/app/(app)/payroll/admin/actions"
import type { PayrollAdminFormState } from "@/app/(app)/payroll/admin/actions"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

const initialState: PayrollAdminFormState = { ok: false, error: null }

// 給与明細の訂正・取消フォーム。給与明細 ID を指定し、期間と金額を訂正、または取消する。
// 金額は再計算せず入力値をそのまま記録する。成否は action の結果を見て toast() で出す。
export function PayslipCorrectForm() {
  // 訂正 action 実行時に結果を見て toast する。レンダー中には副作用を起こさない。
  const correctAction = useActionState(
    async (previousState: PayrollAdminFormState, formData: FormData) => {
      const next = await correctPayslipAction(previousState, formData)

      if (next.ok) {
        toast.success("給与明細を訂正しました")
      } else if (next.error !== null) {
        toast.error(next.error)
      }

      return next
    },
    initialState,
  )

  // 取消 action 実行時に結果を見て toast する。
  const cancelAction = useActionState(
    async (previousState: PayrollAdminFormState, formData: FormData) => {
      const next = await cancelPayslipAction(previousState, formData)

      if (next.ok) {
        toast.success("給与明細を取り消しました")
      } else if (next.error !== null) {
        toast.error(next.error)
      }

      return next
    },
    initialState,
  )

  const correctState = correctAction[0]

  const correctDispatch = correctAction[1]

  const isCorrecting = correctAction[2]

  const cancelDispatch = cancelAction[1]

  const isCancelling = cancelAction[2]

  return (
    <form action={correctDispatch}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="correct-payslip-id">給与明細 ID</FieldLabel>

          <Input
            id="correct-payslip-id"
            name="payslip_id"
            type="number"
            min={1}
            step={1}
            placeholder="1"
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="correct-period">対象期間</FieldLabel>

          <Input id="correct-period" name="period" placeholder="2026-05" required />
        </Field>

        <Field>
          <FieldLabel htmlFor="correct-base-salary">基本給（円）</FieldLabel>

          <Input
            id="correct-base-salary"
            name="base_salary"
            type="number"
            min={0}
            step={1}
            placeholder="300000"
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="correct-allowances">手当（円）</FieldLabel>

          <Input
            id="correct-allowances"
            name="allowances"
            type="number"
            min={0}
            step={1}
            placeholder="0"
            defaultValue={0}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="correct-deductions">控除（円）</FieldLabel>

          <Input
            id="correct-deductions"
            name="deductions"
            type="number"
            min={0}
            step={1}
            placeholder="0"
            defaultValue={0}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="correct-net-pay">差引支給額（円）</FieldLabel>

          <Input
            id="correct-net-pay"
            name="net_pay"
            type="number"
            min={0}
            step={1}
            placeholder="275000"
            required
          />
        </Field>

        {correctState.error !== null ? <FieldError>{correctState.error}</FieldError> : null}

        <Field orientation="horizontal">
          <Button type="submit" disabled={isCorrecting}>
            {isCorrecting ? "訂正中..." : "給与明細を訂正"}
          </Button>

          <Button
            type="submit"
            variant="destructive"
            formAction={cancelDispatch}
            disabled={isCancelling}
          >
            {isCancelling ? "取消中..." : "給与明細を取消"}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
