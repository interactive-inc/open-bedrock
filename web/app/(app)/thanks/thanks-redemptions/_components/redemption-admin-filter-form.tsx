import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"

type Props = {
  statusValue: "pending" | "rejected" | "fulfilled" | ""
  employeeIdValue: string
  rewardIdValue: string
  fromValue: string
  toValue: string
}

const statusOptions = [
  { value: "", label: "すべて" },
  { value: "pending", label: "承認待ち" },
  { value: "fulfilled", label: "交換済み" },
  { value: "rejected", label: "却下" },
]

export function RedemptionAdminFilterForm(props: Props) {
  const hasActiveFilter =
    props.statusValue !== "" ||
    props.employeeIdValue !== "" ||
    props.rewardIdValue !== "" ||
    props.fromValue !== "" ||
    props.toValue !== ""

  return (
    <form method="get" action="/thanks/thanks-redemptions">
      <FieldSet>
        <FieldGroup className="flex-row flex-wrap items-end gap-4">
          <div className="sm:w-40">
            <Field className="w-full">
              <FieldLabel htmlFor="redemption-admin-status">ステータス</FieldLabel>

              <NativeSelect
                id="redemption-admin-status"
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
              <FieldLabel htmlFor="redemption-admin-employee">申請者 ID</FieldLabel>

              <Input
                id="redemption-admin-employee"
                name="employee_id"
                type="text"
                inputMode="numeric"
                defaultValue={props.employeeIdValue}
                placeholder="例: 5"
              />
            </Field>
          </div>

          <div className="sm:w-40">
            <Field className="w-full">
              <FieldLabel htmlFor="redemption-admin-reward">景品 ID</FieldLabel>

              <Input
                id="redemption-admin-reward"
                name="reward_id"
                type="text"
                inputMode="numeric"
                defaultValue={props.rewardIdValue}
                placeholder="例: 1"
              />
            </Field>
          </div>

          <div className="sm:w-44">
            <Field className="w-full">
              <FieldLabel htmlFor="redemption-admin-from">申請日 (以降)</FieldLabel>

              <Input
                id="redemption-admin-from"
                name="from"
                type="date"
                defaultValue={props.fromValue}
              />
            </Field>
          </div>

          <div className="sm:w-44">
            <Field className="w-full">
              <FieldLabel htmlFor="redemption-admin-to">申請日 (以前)</FieldLabel>

              <Input id="redemption-admin-to" name="to" type="date" defaultValue={props.toValue} />
            </Field>
          </div>

          <div className="flex items-end gap-2">
            <Button type="submit">絞り込み</Button>

            {hasActiveFilter ? (
              <Button
                variant="secondary"
                nativeButton={false}
                render={<Link href="/thanks/thanks-redemptions" />}
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
