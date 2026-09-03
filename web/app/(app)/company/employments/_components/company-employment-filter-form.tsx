import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field"

type Props = {
  status: string | null
}

const statusOptions = [
  { value: "", label: "すべて" },
  { value: "ACTIVE", label: "在籍" },
  { value: "ON_LEAVE", label: "休職" },
  { value: "TERMINATED", label: "退職" },
]

/** 雇用一覧の在籍区分フィルタ。method=get で searchParams を更新する。 */
export function CompanyEmploymentFilterForm(props: Props) {
  return (
    <form method="get" action="/company/employments">
      <FieldSet>
        <FieldGroup className="flex-row flex-wrap items-end gap-4">
          <div className="sm:w-48">
            <Field className="w-full">
              <FieldLabel htmlFor="company-employment-status">在籍区分</FieldLabel>

              <select
                id="company-employment-status"
                name="status"
                defaultValue={props.status ?? ""}
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs"
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Button type="submit">絞り込み</Button>
        </FieldGroup>
      </FieldSet>
    </form>
  )
}
