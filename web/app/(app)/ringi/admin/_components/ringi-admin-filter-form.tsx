import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

type Props = {
  statusValue: "pending" | "approved" | "rejected" | ""
  applicantIdValue: string
}

const statusOptions = [
  { value: "", label: "すべて" },
  { value: "pending", label: "承認待ち" },
  { value: "approved", label: "承認済み" },
  { value: "rejected", label: "却下" },
]

export function RingiAdminFilterForm(props: Props) {
  const hasActiveFilter = props.statusValue !== "" || props.applicantIdValue !== ""

  return (
    <form method="get" action="/ringi/admin">
      <FieldSet>
        <FieldGroup className="flex-row flex-wrap items-end gap-4">
          <Field className="w-full sm:w-40">
            <FieldLabel htmlFor="ringi-admin-status">ステータス</FieldLabel>

            <select
              id="ringi-admin-status"
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

          <Field className="w-full sm:w-40">
            <FieldLabel htmlFor="ringi-admin-applicant">起案者 ID</FieldLabel>

            <Input
              id="ringi-admin-applicant"
              name="applicant_id"
              type="text"
              inputMode="numeric"
              defaultValue={props.applicantIdValue}
              placeholder="例: 5"
            />
          </Field>

          <div className="flex items-end gap-2">
            <Button type="submit">絞り込み</Button>

            {hasActiveFilter ? (
              <Button variant="outline" nativeButton={false} render={<Link href="/ringi/admin" />}>
                リセット
              </Button>
            ) : null}
          </div>
        </FieldGroup>
      </FieldSet>
    </form>
  )
}
