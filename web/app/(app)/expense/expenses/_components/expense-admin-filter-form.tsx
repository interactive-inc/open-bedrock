import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

type Props = {
  statusValue: "pending" | "approved" | "rejected" | "settled" | ""
  categoryValue: "transport" | "supplies" | "entertainment" | "books" | "other" | ""
  applicantIdValue: string
  fromValue: string
  toValue: string
}

const statusOptions = [
  { value: "", label: "すべて" },
  { value: "pending", label: "承認待ち" },
  { value: "approved", label: "承認済み" },
  { value: "rejected", label: "却下" },
  { value: "settled", label: "精算済み" },
]

const categoryOptions = [
  { value: "", label: "すべて" },
  { value: "transport", label: "交通費" },
  { value: "supplies", label: "備品" },
  { value: "entertainment", label: "交際費" },
  { value: "books", label: "書籍" },
  { value: "other", label: "その他" },
]

export function ExpenseAdminFilterForm(props: Props) {
  const hasActiveFilter =
    props.statusValue !== "" ||
    props.categoryValue !== "" ||
    props.applicantIdValue !== "" ||
    props.fromValue !== "" ||
    props.toValue !== ""

  return (
    <form method="get" action="/expense/expenses">
      <FieldSet>
        <FieldGroup className="flex-row flex-wrap items-end gap-4">
          <Field className="w-full sm:w-40">
            <FieldLabel htmlFor="expense-admin-status">ステータス</FieldLabel>

            <select
              id="expense-admin-status"
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
            <FieldLabel htmlFor="expense-admin-category">カテゴリ</FieldLabel>

            <select
              id="expense-admin-category"
              name="category"
              defaultValue={props.categoryValue}
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs"
            >
              {categoryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>

          <Field className="w-full sm:w-40">
            <FieldLabel htmlFor="expense-admin-applicant">申請者 ID</FieldLabel>

            <Input
              id="expense-admin-applicant"
              name="applicant_id"
              type="text"
              inputMode="numeric"
              defaultValue={props.applicantIdValue}
              placeholder="例: 5"
            />
          </Field>

          <Field className="w-full sm:w-44">
            <FieldLabel htmlFor="expense-admin-from">申請日 (以降)</FieldLabel>

            <Input id="expense-admin-from" name="from" type="date" defaultValue={props.fromValue} />
          </Field>

          <Field className="w-full sm:w-44">
            <FieldLabel htmlFor="expense-admin-to">申請日 (以前)</FieldLabel>

            <Input id="expense-admin-to" name="to" type="date" defaultValue={props.toValue} />
          </Field>

          <div className="flex items-end gap-2">
            <Button type="submit">絞り込み</Button>

            {hasActiveFilter ? (
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href="/expense/expenses" />}
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
