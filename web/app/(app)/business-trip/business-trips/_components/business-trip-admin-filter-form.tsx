import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"

type Props = {
  statusValue: string
  employeeIdValue: string
}

const statusOptions = [
  { value: "", label: "すべて" },
  { value: "requested", label: "申請中" },
  { value: "approved", label: "承認済み" },
  { value: "rejected", label: "却下" },
]

/** 全社の出張申請一覧を絞り込むフォーム。GET で querystring を更新する。 */
export function BusinessTripAdminFilterForm(props: Props) {
  const hasActiveFilter = props.statusValue !== "" || props.employeeIdValue !== ""

  return (
    <form method="get" action="/business-trip/business-trips">
      <FieldSet>
        <FieldGroup className="flex-row flex-wrap items-end gap-4">
          <div className="sm:w-40">
            <Field className="w-full">
              <FieldLabel htmlFor="business-trip-admin-status">ステータス</FieldLabel>

              <NativeSelect
                id="business-trip-admin-status"
                name="status"
                defaultValue={props.statusValue}
                className="w-full"
              >
                {statusOptions.map((option) => (
                  <NativeSelectOption key={option.value} value={option.value}>
                    {option.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          </div>

          <div className="sm:w-40">
            <Field className="w-full">
              <FieldLabel htmlFor="business-trip-admin-employee">従業員 ID</FieldLabel>

              <Input
                id="business-trip-admin-employee"
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
                render={<Link href="/business-trip/business-trips" />}
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
