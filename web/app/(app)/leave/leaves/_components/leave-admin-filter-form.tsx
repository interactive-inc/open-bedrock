import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

type LeaveTypeFilterValue =
  | "annual"
  | "special"
  | "compensatory"
  | "summer"
  | "child_nursing_care"
  | "prenatal_checkup"
  | "menstrual"
  | "caregiving_leave"
  | ""

type Props = {
  statusValue: "pending" | "approved" | "rejected" | ""
  leaveTypeValue: LeaveTypeFilterValue
  applicantIdValue: string
  fromValue: string
  toValue: string
}

const statusOptions = [
  { value: "", label: "すべて" },
  { value: "pending", label: "承認待ち" },
  { value: "approved", label: "承認済み" },
  { value: "rejected", label: "却下" },
]

const typeOptions = [
  { value: "", label: "すべて" },
  { value: "annual", label: "年次有給" },
  { value: "special", label: "特別休暇" },
  { value: "compensatory", label: "代休" },
  { value: "summer", label: "夏季休暇" },
  { value: "child_nursing_care", label: "子の看護等休暇" },
  { value: "prenatal_checkup", label: "妊婦通院休暇" },
  { value: "menstrual", label: "生理休暇" },
  { value: "caregiving_leave", label: "介護休暇" },
]

export function LeaveAdminFilterForm(props: Props) {
  const hasActiveFilter =
    props.statusValue !== "" ||
    props.leaveTypeValue !== "" ||
    props.applicantIdValue !== "" ||
    props.fromValue !== "" ||
    props.toValue !== ""

  return (
    <form method="get" action="/leave/leaves">
      <FieldSet>
        <FieldGroup className="flex-row flex-wrap items-end gap-4">
          <Field className="w-full sm:w-40">
            <FieldLabel htmlFor="leave-admin-status">ステータス</FieldLabel>

            <select
              id="leave-admin-status"
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
            <FieldLabel htmlFor="leave-admin-type">休暇種別</FieldLabel>

            <select
              id="leave-admin-type"
              name="leave_type"
              defaultValue={props.leaveTypeValue}
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs"
            >
              {typeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>

          <Field className="w-full sm:w-40">
            <FieldLabel htmlFor="leave-admin-applicant">申請者 ID</FieldLabel>

            <Input
              id="leave-admin-applicant"
              name="applicant_id"
              type="text"
              inputMode="numeric"
              defaultValue={props.applicantIdValue}
              placeholder="例: 5"
            />
          </Field>

          <Field className="w-full sm:w-44">
            <FieldLabel htmlFor="leave-admin-from">開始日 (以降)</FieldLabel>

            <Input id="leave-admin-from" name="from" type="date" defaultValue={props.fromValue} />
          </Field>

          <Field className="w-full sm:w-44">
            <FieldLabel htmlFor="leave-admin-to">開始日 (以前)</FieldLabel>

            <Input id="leave-admin-to" name="to" type="date" defaultValue={props.toValue} />
          </Field>

          <div className="flex items-end gap-2">
            <Button type="submit">絞り込み</Button>

            {hasActiveFilter ? (
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href="/leave/leaves" />}
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
