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
  { value: "requested", label: "申請中" },
  { value: "issued", label: "発行済み" },
  { value: "rejected", label: "却下" },
]

// 全社の証明書発行依頼一覧を絞り込むフォーム。GET で querystring を更新する。
export function CertificateRequestAdminFilterForm(props: Props) {
  const hasActiveFilter = props.statusValue !== "" || props.employeeIdValue !== ""

  return (
    <form method="get" action="/organization/certificate-requests">
      <FieldSet>
        <FieldGroup className="flex-row flex-wrap items-end gap-4">
          <Field className="w-full sm:w-40">
            <FieldLabel htmlFor="certificate-request-admin-status">ステータス</FieldLabel>

            <select
              id="certificate-request-admin-status"
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
            <FieldLabel htmlFor="certificate-request-admin-employee">従業員 ID</FieldLabel>

            <Input
              id="certificate-request-admin-employee"
              name="employee_id"
              type="text"
              inputMode="numeric"
              defaultValue={props.employeeIdValue}
              placeholder="例: 5"
            />
          </Field>

          <div className="flex items-end gap-2">
            <Button type="submit">絞り込み</Button>

            {hasActiveFilter ? (
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href="/organization/certificate-requests" />}
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
