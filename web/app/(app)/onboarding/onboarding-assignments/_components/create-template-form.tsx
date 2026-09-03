"use client"

import { useActionState } from "react"
import { toast } from "sonner"
import type { TemplateMutationState } from "@/app/(app)/onboarding/onboarding-assignments/actions"
import { createOnboardingTemplateAction } from "@/app/(app)/onboarding/onboarding-assignments/actions"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"

const initialState: TemplateMutationState = { ok: false, message: null }

/**
 * オンボーディングテンプレート作成フォーム（管理権限向け）。code/name/kind/description を native form で送る。
 * 成功・失敗は action の結果を見て toast で出す。
 */
export function CreateTemplateForm() {
  const action = useActionState(
    async (previousState: TemplateMutationState, formData: FormData) => {
      const next = await createOnboardingTemplateAction(previousState, formData)

      if (next.ok && next.message !== null) {
        toast.success(next.message)
      } else if (next.message !== null) {
        toast.error(next.message)
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

          <Input id="template-code" name="code" placeholder="engineer_join" required />
        </Field>

        <Field>
          <FieldLabel htmlFor="template-name">名称</FieldLabel>

          <Input id="template-name" name="name" placeholder="入社手続き" required />
        </Field>

        <Field>
          <FieldLabel htmlFor="template-kind">種別</FieldLabel>

          <NativeSelect id="template-kind" name="kind" defaultValue="join">
            <NativeSelectOption value="join">入社</NativeSelectOption>

            <NativeSelectOption value="leave">退社</NativeSelectOption>
          </NativeSelect>
        </Field>

        <Field>
          <FieldLabel htmlFor="template-description">説明</FieldLabel>

          <Textarea id="template-description" name="description" placeholder="テンプレートの概要" />
        </Field>

        {state.message !== null && state.ok === false ? (
          <FieldError>{state.message}</FieldError>
        ) : null}

        <Field orientation="horizontal">
          <Button type="submit" disabled={isPending}>
            {isPending ? "作成中..." : "テンプレートを作成"}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
