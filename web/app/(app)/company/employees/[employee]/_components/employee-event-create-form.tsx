"use client"

import { Plus } from "lucide-react"
import { useActionState, useState } from "react"
import { toast } from "sonner"
import { createEmployeeEventAction } from "@/app/(app)/company/employees/[employee]/actions"
import type { FactRecordFormState } from "@/app/(app)/company/employees/[employee]/actions"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { FORM_CONSTRAINTS } from "@/lib/form/constraints"

const initialState: FactRecordFormState = { ok: false, error: null }

/** Select のトリガーに生値でなくラベルを表示するための対応表（Base UI Select の items）。 */
const eventKindItems = {
  join: "入社",
  transfer: "異動",
  leave_of_absence: "休職",
  return: "復職",
  retire: "退職",
}

type Props = {
  employeeCode: string
}

/** 異動・在籍イベントの記録フォームを Dialog で開く。種別・適用日は必須、部署コードと備考は任意。 */
export function EmployeeEventCreateForm(props: Props) {
  const [open, setOpen] = useState(false)

  async function reduce(
    previousState: FactRecordFormState,
    formData: FormData,
  ): Promise<FactRecordFormState> {
    const result = await createEmployeeEventAction(previousState, formData)

    if (result.ok) {
      toast.success("異動・在籍イベントを記録しました")

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
      <DialogTrigger render={<Button variant="secondary" size="sm" />}>
        <Plus />
        記録を追加
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>異動・在籍イベントを記録</DialogTitle>

          <DialogDescription>
            入社・異動・休職・復職・退職の事実を記録します。組織図や台帳は変更しません。
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="employee_code" value={props.employeeCode} />

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="event-kind">種別</FieldLabel>

              <Select name="kind" defaultValue="transfer" items={eventKindItems}>
                <SelectTrigger id="event-kind">
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="join">入社</SelectItem>
                  <SelectItem value="transfer">異動</SelectItem>
                  <SelectItem value="leave_of_absence">休職</SelectItem>
                  <SelectItem value="return">復職</SelectItem>
                  <SelectItem value="retire">退職</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="event-effective-date">適用日</FieldLabel>

              <Input id="event-effective-date" name="effective_date" type="date" required />
            </Field>

            <Field>
              <FieldLabel htmlFor="event-from-department">異動元部署コード（任意）</FieldLabel>

              <Input
                id="event-from-department"
                name="from_department_code"
                placeholder="D001"
                maxLength={FORM_CONSTRAINTS.employeeEvent.departmentCodeMax}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="event-to-department">異動先部署コード（任意）</FieldLabel>

              <Input
                id="event-to-department"
                name="to_department_code"
                placeholder="D002"
                maxLength={FORM_CONSTRAINTS.employeeEvent.departmentCodeMax}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="event-note">備考（任意）</FieldLabel>

              <Textarea
                id="event-note"
                name="note"
                maxLength={FORM_CONSTRAINTS.employeeEvent.noteMax}
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
