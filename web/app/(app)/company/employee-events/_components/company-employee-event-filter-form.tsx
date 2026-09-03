import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import type { EmployeeEventKind } from "@/lib/api/types/employee-event-types"

type Props = {
  employeeCode: string | null
  kind: EmployeeEventKind | null
}

const kindOptions = [
  { value: "", label: "すべて" },
  { value: "join", label: "入社" },
  { value: "transfer", label: "異動" },
  { value: "leave_of_absence", label: "休職" },
  { value: "return", label: "復職" },
  { value: "retire", label: "退職" },
]

/** 雇用事実の絞り込みフォーム。従業員コードは api が必須で要求する。 */
export function CompanyEmployeeEventFilterForm(props: Props) {
  return (
    <form method="get" action="/company/employee-events">
      <FieldSet>
        <FieldGroup className="flex-row flex-wrap items-end gap-4">
          <Field className="w-full sm:w-56">
            <FieldLabel htmlFor="company-employee-event-code">従業員コード</FieldLabel>

            <Input
              id="company-employee-event-code"
              name="employee_code"
              type="text"
              required
              defaultValue={props.employeeCode ?? ""}
              placeholder="E001"
            />
          </Field>

          <Field className="w-full sm:w-40">
            <FieldLabel htmlFor="company-employee-event-kind">種別</FieldLabel>

            <select
              id="company-employee-event-kind"
              name="kind"
              defaultValue={props.kind ?? ""}
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs"
            >
              {kindOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>

          <Button type="submit">絞り込み</Button>
        </FieldGroup>
      </FieldSet>
    </form>
  )
}
