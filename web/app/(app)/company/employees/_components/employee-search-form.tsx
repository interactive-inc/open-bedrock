import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field"
import type { EmployeeSearchFilter } from "@/lib/api/types/employee-search-filter"

type Props = {
  filter: EmployeeSearchFilter
}

const statusOptions = [
  { value: "", label: "すべて" },
  { value: "active", label: "在籍" },
  { value: "leave", label: "休職" },
  { value: "retired", label: "退職" },
]

/**
 * 従業員一覧の絞り込みフォーム。
 * method=get で /employees に submit し、searchParams を更新する（クライアント JS 不要）。
 */
export function EmployeeSearchForm(props: Props) {
  return (
    <form method="get" action="/company/employees">
      <FieldSet>
        <FieldGroup className="flex-row flex-wrap items-end gap-4">
          <Field className="w-full sm:w-64">
            <FieldLabel htmlFor="employee-search-q">キーワード</FieldLabel>

            <Input
              id="employee-search-q"
              name="q"
              type="search"
              defaultValue={props.filter.q ?? ""}
              placeholder="氏名・メールなど"
            />
          </Field>

          <Field className="w-full sm:w-48">
            <FieldLabel htmlFor="employee-search-dept">部署</FieldLabel>

            <Input
              id="employee-search-dept"
              name="dept"
              type="text"
              defaultValue={props.filter.dept ?? ""}
              placeholder="部署名"
            />
          </Field>

          <Field className="w-full sm:w-40">
            <FieldLabel htmlFor="employee-search-status">在籍状況</FieldLabel>

            <select
              id="employee-search-status"
              name="status"
              defaultValue={props.filter.status ?? ""}
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs"
            >
              {statusOptions.map((option) => (
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
