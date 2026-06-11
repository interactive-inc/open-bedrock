"use client"

import { useActionState, useState } from "react"
import {
  deleteApplicationTemplateAction,
  updateApplicationTemplateAction,
} from "@/app/(app)/applications/templates/actions"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

// 変更 Dialog と削除に必要な最小のテンプレート形。詳細取得（id なし）にも一覧取得にも適合する。
type ManagedTemplate = {
  code: string
  name: string
  category: string
  description: string | null
  schema_json: unknown
  approver_roles: ReadonlyArray<string>
}

type Props = {
  template: ManagedTemplate
}

// テンプレートの管理操作（変更 Dialog と削除）。管理権限にのみ表示する。
export function TemplateManagement(props: Props) {
  return (
    <div className="flex items-center gap-2">
      <UpdateTemplateDialog template={props.template} />

      <DeleteTemplateButton code={props.template.code} />
    </div>
  )
}

// テンプレート変更フォームを Dialog で開く。名称・カテゴリ・説明・スキーマ・承認ロールを編集する。
function UpdateTemplateDialog(props: { template: ManagedTemplate }) {
  const [open, setOpen] = useState(false)

  const [state, formAction, pending] = useActionState(updateApplicationTemplateAction, {
    ok: false,
    error: null,
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>変更</DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>テンプレートを変更</DialogTitle>

          <DialogDescription>コードは変更されません。</DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="code" value={props.template.code} />

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="update_name">名称</FieldLabel>

              <Input id="update_name" name="name" defaultValue={props.template.name} />
            </Field>

            <Field>
              <FieldLabel htmlFor="update_category">カテゴリ</FieldLabel>

              <Input id="update_category" name="category" defaultValue={props.template.category} />
            </Field>

            <Field>
              <FieldLabel htmlFor="update_description">説明</FieldLabel>

              <Input
                id="update_description"
                name="description"
                defaultValue={props.template.description ?? ""}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="update_approver_roles">承認ロール（カンマ区切り）</FieldLabel>

              <Input
                id="update_approver_roles"
                name="approver_roles"
                defaultValue={props.template.approver_roles.join(", ")}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="update_schema">スキーマ（JSON）</FieldLabel>

              <Textarea
                id="update_schema"
                name="schema_json"
                className="font-mono"
                defaultValue={JSON.stringify(props.template.schema_json, null, 2)}
              />
            </Field>
          </FieldGroup>

          {state.error === null ? null : <p className="text-sm text-destructive">{state.error}</p>}

          <Button type="submit" disabled={pending}>
            変更を保存
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// テンプレートを削除するボタン。Server Action を呼び、成功時は一覧が revalidate される。
function DeleteTemplateButton(props: { code: string }) {
  const [state, formAction, pending] = useActionState(deleteApplicationTemplateAction, {
    ok: false,
    error: null,
  })

  return (
    <form action={formAction}>
      <input type="hidden" name="code" value={props.code} />

      <Button type="submit" variant="destructive" size="sm" disabled={pending}>
        削除
      </Button>

      {state.error === null ? null : <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  )
}
