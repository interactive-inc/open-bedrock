"use client"

import { useActionState } from "react"
import { toast } from "sonner"
import type { TrainingFormState } from "@/app/(app)/training/actions"
import { createTrainingCourseAction } from "@/app/(app)/training/actions"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

const initialState: TrainingFormState = { ok: false, error: null }

// 研修コース作成フォーム（特権ロール向け）。code/title/category/所要時間/説明/必須フラグを native form で送る。
// 成功・失敗は action の結果を見て toast() で出す（useEffect は使わない）。
export function CreateCourseForm() {
  // action 実行時（送信時）に結果を見て toast する。レンダー中には副作用を起こさない。
  const action = useActionState(async (previousState: TrainingFormState, formData: FormData) => {
    const next = await createTrainingCourseAction(previousState, formData)

    if (next.ok) {
      toast.success("コースを作成しました")
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
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="course-code">コード</FieldLabel>

          <Input id="course-code" name="code" placeholder="SEC-101" required />
        </Field>

        <Field>
          <FieldLabel htmlFor="course-title">コース名</FieldLabel>

          <Input id="course-title" name="title" placeholder="情報セキュリティ基礎" required />
        </Field>

        <Field>
          <FieldLabel htmlFor="course-category">カテゴリ</FieldLabel>

          <Input id="course-category" name="category" placeholder="compliance" required />
        </Field>

        <Field>
          <FieldLabel htmlFor="course-duration">所要時間（分）</FieldLabel>

          <Input id="course-duration" name="duration_minutes" type="number" placeholder="60" />
        </Field>

        <Field>
          <FieldLabel htmlFor="course-description">説明</FieldLabel>

          <Textarea id="course-description" name="description" placeholder="コースの概要を入力" />
        </Field>

        <Field orientation="horizontal">
          <input id="course-required" name="is_required" type="checkbox" className="size-4" />

          <FieldLabel htmlFor="course-required">必須コースにする</FieldLabel>
        </Field>

        {state.error !== null ? <FieldError>{state.error}</FieldError> : null}

        <Field orientation="horizontal">
          <Button type="submit" disabled={isPending}>
            {isPending ? "作成中..." : "コースを作成"}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
