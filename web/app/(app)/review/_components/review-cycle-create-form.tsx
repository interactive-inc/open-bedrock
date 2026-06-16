"use client"

import { useActionState } from "react"
import { toast } from "sonner"
import type { ReviewFormState } from "@/app/(app)/review/actions"
import { createReviewCycleAction } from "@/app/(app)/review/actions"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { FORM_CONSTRAINTS } from "@/lib/form/constraints"

const initialState: ReviewFormState = { ok: false, error: null }

// 評価サイクルの作成フォーム（特権ロール向け）。タイトル・対象期間・締切日を native form で送る。
// 成功・失敗の通知は action の結果を見て toast() で出す（useEffect は使わない）。
export function ReviewCycleCreateForm() {
  // action 実行時（送信時）に結果を見て toast する。レンダー中には副作用を起こさない。
  const action = useActionState(async (previousState: ReviewFormState, formData: FormData) => {
    const next = await createReviewCycleAction(previousState, formData)

    if (next.ok) {
      toast.success("評価サイクルを作成しました")
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
          <FieldLabel htmlFor="review-cycle-title">タイトル</FieldLabel>

          <Input
            id="review-cycle-title"
            name="title"
            placeholder="2026 上期評価"
            maxLength={FORM_CONSTRAINTS.review.titleMax}
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="review-cycle-period">対象期間</FieldLabel>

          <Input
            id="review-cycle-period"
            name="period"
            placeholder="2026-H1"
            maxLength={FORM_CONSTRAINTS.review.periodMax}
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="review-cycle-due-date">締切日</FieldLabel>

          <Input id="review-cycle-due-date" name="due_date" type="date" />
        </Field>

        {state.error !== null ? <FieldError>{state.error}</FieldError> : null}

        <Field orientation="horizontal">
          <Button type="submit" disabled={isPending}>
            {isPending ? "作成中..." : "評価サイクルを作成"}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
