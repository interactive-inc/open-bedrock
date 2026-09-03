"use client"

import { useActionState } from "react"
import { toast } from "sonner"
import type { CareerPostingFormState } from "@/app/(app)/my/career/actions"
import { createCareerPostingAction } from "@/app/(app)/my/career/actions"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { FORM_CONSTRAINTS } from "@/lib/form/constraints"

const initialState: CareerPostingFormState = { ok: false, error: null }

/**
 * 社内公募の作成フォーム（管理ロール向け）。title 必須、部署・必要スキル・状態は任意。
 * 成功・失敗は action の結果を見て toast() で出す（useEffect は使わない）。
 */
export function CreatePostingForm() {
  const action = useActionState(
    async (previousState: CareerPostingFormState, formData: FormData) => {
      const next = await createCareerPostingAction(previousState, formData)

      if (next.ok) {
        toast.success("公募を作成しました")
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
          <FieldLabel htmlFor="posting-title">公募名</FieldLabel>

          <Input
            id="posting-title"
            name="title"
            placeholder="Backend Engineer"
            maxLength={FORM_CONSTRAINTS.career.postingTitleMax}
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="posting-dept-id">部署ID</FieldLabel>

          <Input id="posting-dept-id" name="dept_id" type="number" placeholder="3" />
        </Field>

        <Field>
          <FieldLabel htmlFor="posting-dept-name">部署名</FieldLabel>

          <Input
            id="posting-dept-name"
            name="dept_name"
            placeholder="Engineering"
            maxLength={FORM_CONSTRAINTS.career.deptNameMax}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="posting-skills">必要スキル</FieldLabel>

          <Input
            id="posting-skills"
            name="required_skills"
            placeholder="typescript,go"
            maxLength={FORM_CONSTRAINTS.career.requiredSkillsMax}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="posting-status">状態</FieldLabel>

          <NativeSelect id="posting-status" name="status" defaultValue="open">
            <NativeSelectOption value="open">募集中</NativeSelectOption>

            <NativeSelectOption value="closed">締切</NativeSelectOption>
          </NativeSelect>
        </Field>

        {state.error !== null ? <FieldError>{state.error}</FieldError> : null}

        <Field orientation="horizontal">
          <Button type="submit" disabled={isPending}>
            {isPending ? "作成中..." : "公募を作成"}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
