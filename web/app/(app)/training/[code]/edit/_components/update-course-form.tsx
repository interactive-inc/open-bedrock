"use client"

import { useActionState } from "react"
import { toast } from "sonner"
import type { TrainingFormState } from "@/app/(app)/training/actions"
import { updateTrainingCourseAction } from "@/app/(app)/training/actions"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { TrainingCourseResponse } from "@/lib/api/types/training-types"

type Props = {
  course: TrainingCourseResponse
}

const initialState: TrainingFormState = { ok: false, error: null }

/**
 * 研修コース変更フォーム。コード/状態は変更しないため hidden の code のみ送る。
 */
export function UpdateCourseForm(props: Props) {
  const action = useActionState(async (previousState: TrainingFormState, formData: FormData) => {
    const next = await updateTrainingCourseAction(previousState, formData)

    if (next.ok) {
      toast.success("コースを更新しました")
    } else if (next.error !== null) {
      toast.error(next.error)
    }

    return next
  }, initialState)

  const state = action[0]

  const dispatch = action[1]

  const isPending = action[2]

  return (
    <form action={dispatch}>
      <input type="hidden" name="code" value={props.course.code} />

      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="update_title">コース名</FieldLabel>

          <Input id="update_title" name="title" defaultValue={props.course.title} required />
        </Field>

        <Field>
          <FieldLabel htmlFor="update_category">カテゴリ</FieldLabel>

          <Input
            id="update_category"
            name="category"
            defaultValue={props.course.category}
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="update_duration">所要時間（分）</FieldLabel>

          <Input
            id="update_duration"
            name="duration_minutes"
            type="number"
            defaultValue={props.course.duration_minutes ?? ""}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="update_description">説明</FieldLabel>

          <Textarea
            id="update_description"
            name="description"
            defaultValue={props.course.description ?? ""}
          />
        </Field>

        <Field orientation="horizontal">
          <input
            id="update_required"
            name="is_required"
            type="checkbox"
            className="size-4"
            defaultChecked={props.course.is_required}
          />

          <FieldLabel htmlFor="update_required">必須コースにする</FieldLabel>
        </Field>

        {state.error !== null ? <FieldError>{state.error}</FieldError> : null}

        <Field orientation="horizontal">
          <Button type="submit" disabled={isPending}>
            {isPending ? "更新中..." : "変更を保存"}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
