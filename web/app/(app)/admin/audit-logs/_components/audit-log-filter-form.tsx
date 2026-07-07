import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

type Props = {
  actionValue: string
  targetTypeValue: string
  actorAccountIdValue: string
  fromValue: string
  toValue: string
}

// 監査ログ一覧の絞り込みフォーム。GET でクエリを URL に載せ、RSC 側で読み取る。
export function AuditLogFilterForm(props: Props) {
  const hasActiveFilter =
    props.actionValue !== "" ||
    props.targetTypeValue !== "" ||
    props.actorAccountIdValue !== "" ||
    props.fromValue !== "" ||
    props.toValue !== ""

  return (
    <form method="get" action="/admin/audit-logs">
      <FieldSet>
        <FieldGroup className="flex-row flex-wrap items-end gap-4">
          <Field className="w-full sm:w-56">
            <FieldLabel htmlFor="audit-log-action">アクション</FieldLabel>

            <Input
              id="audit-log-action"
              name="action"
              type="text"
              defaultValue={props.actionValue}
              placeholder="例: account.status.change"
            />
          </Field>

          <Field className="w-full sm:w-44">
            <FieldLabel htmlFor="audit-log-target-type">対象種別</FieldLabel>

            <Input
              id="audit-log-target-type"
              name="target_type"
              type="text"
              defaultValue={props.targetTypeValue}
              placeholder="例: account"
            />
          </Field>

          <Field className="w-full sm:w-40">
            <FieldLabel htmlFor="audit-log-actor">操作者アカウント ID</FieldLabel>

            <Input
              id="audit-log-actor"
              name="actor_account_id"
              type="text"
              inputMode="numeric"
              defaultValue={props.actorAccountIdValue}
              placeholder="例: 1"
            />
          </Field>

          <Field className="w-full sm:w-44">
            <FieldLabel htmlFor="audit-log-from">日時 (以降)</FieldLabel>

            <Input id="audit-log-from" name="from" type="date" defaultValue={props.fromValue} />
          </Field>

          <Field className="w-full sm:w-44">
            <FieldLabel htmlFor="audit-log-to">日時 (以前)</FieldLabel>

            <Input id="audit-log-to" name="to" type="date" defaultValue={props.toValue} />
          </Field>

          <div className="flex items-end gap-2">
            <Button type="submit">絞り込み</Button>

            {hasActiveFilter ? (
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href="/admin/audit-logs" />}
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
