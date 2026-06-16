"use client"

import { useRouter } from "next/navigation"
import { useActionState } from "react"
import { toast } from "sonner"
import type { CareerPostingFormState } from "@/app/(app)/career/actions"
import { updateCareerPostingAction } from "@/app/(app)/career/actions"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import type { CareerPosting } from "@/lib/api/types/career-types"
import { FORM_CONSTRAINTS } from "@/lib/form/constraints"

type Props = {
  posting: CareerPosting
}

const initialState: CareerPostingFormState = { ok: false, error: null }

/**
 * 公募の編集フォーム（管理ロール向け）。Server Action 成功で詳細ページに遷移する。
 */
export function EditPostingForm(props: Props) {
  const router = useRouter()

  async function reduce(
    previousState: CareerPostingFormState,
    formData: FormData,
  ): Promise<CareerPostingFormState> {
    const next = await updateCareerPostingAction(previousState, formData)

    if (next.ok) {
      toast.success("公募を更新しました")

      router.push(`/career/postings/${props.posting.id ?? ""}`)
    } else if (next.error !== null) {
      toast.error(next.error)
    }

    return next
  }

  const action = useActionState(reduce, initialState)

  const state = action[0]

  const dispatch = action[1]

  const isPending = action[2]

  return (
    <form action={dispatch}>
      <input type="hidden" name="posting_id" value={props.posting.id ?? ""} />

      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="edit-posting-title">公募名</FieldLabel>

          <Input
            id="edit-posting-title"
            name="title"
            defaultValue={props.posting.title}
            maxLength={FORM_CONSTRAINTS.career.postingTitleMax}
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="edit-posting-dept-id">部署ID</FieldLabel>

          <Input
            id="edit-posting-dept-id"
            name="dept_id"
            type="number"
            defaultValue={props.posting.dept_id ?? ""}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="edit-posting-dept-name">部署名</FieldLabel>

          <Input
            id="edit-posting-dept-name"
            name="dept_name"
            defaultValue={props.posting.dept_name ?? ""}
            maxLength={FORM_CONSTRAINTS.career.deptNameMax}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="edit-posting-skills">必要スキル</FieldLabel>

          <Input
            id="edit-posting-skills"
            name="required_skills"
            defaultValue={props.posting.required_skills ?? ""}
            maxLength={FORM_CONSTRAINTS.career.requiredSkillsMax}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="edit-posting-status">状態</FieldLabel>

          <select
            id="edit-posting-status"
            name="status"
            defaultValue={props.posting.status}
            className="h-9 rounded-md border bg-transparent px-3 text-sm"
          >
            <option value="open">募集中</option>

            <option value="closed">締切</option>
          </select>
        </Field>

        {state.error !== null ? <FieldError>{state.error}</FieldError> : null}

        <Field orientation="horizontal">
          <Button type="submit" disabled={isPending}>
            {isPending ? "保存中..." : "変更を保存"}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
