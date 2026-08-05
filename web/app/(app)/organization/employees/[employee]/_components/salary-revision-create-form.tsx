"use client"

import { Plus } from "lucide-react"
import { useActionState, useState } from "react"
import { toast } from "sonner"
import { createSalaryRevisionAction } from "@/app/(app)/organization/employees/[employee]/actions"
import type { FactRecordFormState } from "@/app/(app)/organization/employees/[employee]/actions"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { FORM_CONSTRAINTS } from "@/lib/form/constraints"

const initialState: FactRecordFormState = { ok: false, error: null }

type Props = {
  employeeCode: string
}

/** 給与改定の記録フォームを Dialog で開く。適用日・前後の基本給は必須、理由は任意。最機微の事実記録。 */
export function SalaryRevisionCreateForm(props: Props) {
  const [open, setOpen] = useState(false)

  async function reduce(
    previousState: FactRecordFormState,
    formData: FormData,
  ): Promise<FactRecordFormState> {
    const result = await createSalaryRevisionAction(previousState, formData)

    if (result.ok) {
      toast.success("給与改定を記録しました")

      setOpen(false)
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Plus />
        記録を追加
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>給与改定を記録</DialogTitle>

          <DialogDescription>
            基本給の改定事実を記録します。給与計算は行いません。
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="employee_code" value={props.employeeCode} />

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="revision-effective-date">適用日</FieldLabel>

              <Input id="revision-effective-date" name="effective_date" type="date" required />
            </Field>

            <Field>
              <FieldLabel htmlFor="revision-previous-salary">前回基本給（円）</FieldLabel>

              <Input
                id="revision-previous-salary"
                name="previous_base_salary"
                type="number"
                inputMode="numeric"
                min={FORM_CONSTRAINTS.salaryRevision.baseSalaryMin}
                max={FORM_CONSTRAINTS.salaryRevision.baseSalaryMax}
                step={1}
                required
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="revision-new-salary">改定後基本給（円）</FieldLabel>

              <Input
                id="revision-new-salary"
                name="new_base_salary"
                type="number"
                inputMode="numeric"
                min={FORM_CONSTRAINTS.salaryRevision.baseSalaryMin}
                max={FORM_CONSTRAINTS.salaryRevision.baseSalaryMax}
                step={1}
                required
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="revision-reason">理由（任意）</FieldLabel>

              <Textarea
                id="revision-reason"
                name="reason"
                maxLength={FORM_CONSTRAINTS.salaryRevision.reasonMax}
              />
            </Field>

            {state.error !== null ? <FieldError>{state.error}</FieldError> : null}

            <Field orientation="horizontal">
              <Button type="submit" disabled={isPending}>
                {isPending ? "記録中..." : "記録する"}
              </Button>
            </Field>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  )
}
