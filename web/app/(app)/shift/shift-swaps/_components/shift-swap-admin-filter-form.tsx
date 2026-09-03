import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

type Props = {
  statusValue: string
  requesterIdValue: string
  targetIdValue: string
  fromValue: string
  toValue: string
}

const statusOptions = [
  { value: "", label: "すべて" },
  { value: "pending", label: "承認待ち" },
  { value: "approved", label: "承認済み" },
]

export function ShiftSwapAdminFilterForm(props: Props) {
  const hasActiveFilter =
    props.statusValue !== "" ||
    props.requesterIdValue !== "" ||
    props.targetIdValue !== "" ||
    props.fromValue !== "" ||
    props.toValue !== ""

  return (
    <form method="get" action="/shift/shift-swaps">
      <FieldSet>
        <FieldGroup className="flex-row flex-wrap items-end gap-4">
          <div className="sm:w-40">
            <Field className="w-full">
              <FieldLabel htmlFor="swap-admin-status">ステータス</FieldLabel>

              <select
                id="swap-admin-status"
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
              <FieldLabel htmlFor="swap-admin-requester">申請者 ID</FieldLabel>

              <Input
                id="swap-admin-requester"
                name="requester_id"
                type="text"
                inputMode="numeric"
                defaultValue={props.requesterIdValue}
                placeholder="例: 5"
              />
            </Field>
          </div>

          <div className="sm:w-40">
            <Field className="w-full">
              <FieldLabel htmlFor="swap-admin-target">交代先 ID</FieldLabel>

              <Input
                id="swap-admin-target"
                name="target_id"
                type="text"
                inputMode="numeric"
                defaultValue={props.targetIdValue}
                placeholder="例: 4"
              />
            </Field>
          </div>

          <div className="sm:w-44">
            <Field className="w-full">
              <FieldLabel htmlFor="swap-admin-from">対象日 (以降)</FieldLabel>

              <Input id="swap-admin-from" name="from" type="date" defaultValue={props.fromValue} />
            </Field>
          </div>

          <div className="sm:w-44">
            <Field className="w-full">
              <FieldLabel htmlFor="swap-admin-to">対象日 (以前)</FieldLabel>

              <Input id="swap-admin-to" name="to" type="date" defaultValue={props.toValue} />
            </Field>
          </div>

          <div className="flex items-end gap-2">
            <Button type="submit">絞り込み</Button>

            {hasActiveFilter ? (
              <Button
                variant="secondary"
                nativeButton={false}
                render={<Link href="/shift/shift-swaps" />}
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
