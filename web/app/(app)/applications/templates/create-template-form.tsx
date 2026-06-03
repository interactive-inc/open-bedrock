"use client"

import { useActionState } from "react"
import { toast } from "sonner"
import type { ApplicationTemplateFormState } from "@/app/(app)/applications/templates/actions"
import { createApplicationTemplateAction } from "@/app/(app)/applications/templates/actions"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

const initialState: ApplicationTemplateFormState = { ok: false, error: null }

// 申請テンプレート作成フォーム（管理権限向け）。code/name/category/説明/スキーマ/承認ロールを native form で送る。
// 成功・失敗は action の結果を見て toast() で出す（useEffect は使わない）。
export function CreateTemplateForm() {
  const action = useActionState(
    async (previousState: ApplicationTemplateFormState, formData: FormData) => {
      const next = await createApplicationTemplateAction(previousState, formData)

      if (next.ok) {
        toast.success("テンプレートを作成しました")
      } else if (next.error !== null) {
        toast.error(next.error)
      }

      return next
    },
    initialState,
  )

  const state = action[0]

  const dispatch = action[1]

  const isPending = action[2]

  return (
    <form action={dispatch}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="template-code">コード</FieldLabel>

          <Input id="template-code" name="code" placeholder="paid_leave" required />
        </Field>

        <Field>
          <FieldLabel htmlFor="template-name">名称</FieldLabel>

          <Input id="template-name" name="name" placeholder="有給休暇申請" required />
        </Field>

        <Field>
          <FieldLabel htmlFor="template-category">カテゴリ</FieldLabel>

          <Input id="template-category" name="category" placeholder="attendance" required />
        </Field>

        <Field>
          <FieldLabel htmlFor="template-description">説明</FieldLabel>

          <Textarea id="template-description" name="description" placeholder="テンプレートの概要" />
        </Field>

        <Field>
          <FieldLabel htmlFor="template-approver-roles">承認ロール（カンマ区切り）</FieldLabel>

          <Input id="template-approver-roles" name="approver_roles" placeholder="manager, admin" />
        </Field>

        <Field>
          <FieldLabel htmlFor="template-schema">スキーマ（JSON）</FieldLabel>

          <Textarea
            id="template-schema"
            name="schema_json"
            placeholder='{ "type": "object" }'
            className="font-mono"
          />
        </Field>

        {state.error !== null ? <FieldError>{state.error}</FieldError> : null}

        <Field orientation="horizontal">
          <Button type="submit" disabled={isPending}>
            {isPending ? "作成中..." : "テンプレートを作成"}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
