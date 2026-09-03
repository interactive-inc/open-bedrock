import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

type Props = {
  statusValue: string
  employeeIdValue: string
}

const statusOptions = [
  { value: "", label: "すべて" },
  { value: "submitted", label: "提出済み" },
  { value: "approved", label: "承認済み" },
  { value: "rejected", label: "却下" },
]

/** 全社のライフイベント届一覧を絞り込むフォーム。GET で querystring を更新する。 */
export function LifeEventAdminFilterForm(props: Props) {
  const hasActiveFilter = props.statusValue !== "" || props.employeeIdValue !== ""

  return (
    <form method="get" action="/life-event/life-events">
      <FieldSet>
        <FieldGroup className="flex-row flex-wrap items-end gap-4">
          <div className="sm:w-40">
            <Field className="w-full">
              <FieldLabel htmlFor="life-event-admin-status">ステータス</FieldLabel>

              <select
                id="life-event-admin-status"
                name="status"
                defaultValue={props.statusValue}
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

          <div className="sm:w-40">
            <Field className="w-full">
              <FieldLabel htmlFor="life-event-admin-employee">従業員 ID</FieldLabel>

              <Input
                id="life-event-admin-employee"
                name="employee_id"
                type="text"
                inputMode="numeric"
                defaultValue={props.employeeIdValue}
                placeholder="例: 5"
              />
            </Field>
          </div>

          <div className="flex items-end gap-2">
            <Button type="submit">絞り込み</Button>

            {hasActiveFilter ? (
              <Button
                variant="secondary"
                nativeButton={false}
                render={<Link href="/life-event/life-events" />}
              >
                リセット
              </Button>
            ) : null}
          </div>
        </FieldGroup>
      </FieldSet>
    </form>
  )
}
