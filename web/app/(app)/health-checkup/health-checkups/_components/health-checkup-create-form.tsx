"use client"

import { useRouter } from "next/navigation"
import { useActionState } from "react"
import { toast } from "sonner"
import { createHealthCheckupAction } from "@/app/(app)/health-checkup/health-checkups/actions"
import type { HealthCheckupActionState } from "@/app/(app)/health-checkup/health-checkups/actions"
import { EmployeeSelect } from "@/components/employee-select"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { FORM_CONSTRAINTS } from "@/lib/form/constraints"

const initialState: HealthCheckupActionState = { ok: false, error: null }

/** Select のトリガーに生値でなくラベルを表示するための対応表（Base UI Select の items）。 */
const checkupKindItems = {
  regular: "定期健診",
  stress_check: "ストレスチェック",
}

const checkupStatusItems = {
  scheduled: "予定",
  completed: "受診済み",
  declined: "辞退",
}

type Props = {
  employees: ReadonlyArray<{ code: string; name: string }>
  defaultFiscalYear: number
}

/** 実施記録の登録フォーム。対象者・年度・種別は必須、実施日・状態・備考は任意。成功時は一覧へ戻す。 */
export function HealthCheckupCreateForm(props: Props) {
  const router = useRouter()

  async function reduce(
    previousState: HealthCheckupActionState,
    formData: FormData,
  ): Promise<HealthCheckupActionState> {
    const result = await createHealthCheckupAction(previousState, formData)

    if (result.ok) {
      toast.success("実施記録を登録しました")

      router.push("/health-checkup/health-checkups")
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
    <form action={formAction}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="checkup-employee">対象者</FieldLabel>

          <EmployeeSelect
            id="checkup-employee"
            name="employee_code"
            employees={props.employees}
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="checkup-fiscal-year">年度</FieldLabel>

          <Input
            id="checkup-fiscal-year"
            name="fiscal_year"
            type="number"
            inputMode="numeric"
            min={FORM_CONSTRAINTS.healthCheckup.fiscalYearMin}
            max={FORM_CONSTRAINTS.healthCheckup.fiscalYearMax}
            step={1}
            defaultValue={props.defaultFiscalYear}
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="checkup-kind">種別</FieldLabel>

          <Select name="checkup_kind" defaultValue="regular" items={checkupKindItems}>
            <SelectTrigger id="checkup-kind">
              <SelectValue />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value="regular">定期健診</SelectItem>
              <SelectItem value="stress_check">ストレスチェック</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <FieldLabel htmlFor="checkup-status">受診状態</FieldLabel>

          <Select name="status" defaultValue="scheduled" items={checkupStatusItems}>
            <SelectTrigger id="checkup-status">
              <SelectValue />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value="scheduled">予定</SelectItem>
              <SelectItem value="completed">受診済み</SelectItem>
              <SelectItem value="declined">辞退</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <FieldLabel htmlFor="checkup-conducted-on">実施日（任意）</FieldLabel>

          <Input id="checkup-conducted-on" name="conducted_on" type="date" />
        </Field>

        <Field>
          <FieldLabel htmlFor="checkup-note">備考（任意）</FieldLabel>

          <Textarea
            id="checkup-note"
            name="note"
            maxLength={FORM_CONSTRAINTS.healthCheckup.noteMax}
          />

          <FieldDescription>健診結果は記録しません。実施情報のみを扱います。</FieldDescription>
        </Field>

        {state.error !== null ? <FieldError>{state.error}</FieldError> : null}

        <Field orientation="horizontal">
          <Button type="submit" disabled={isPending}>
            {isPending ? "登録中..." : "実施記録を登録"}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
