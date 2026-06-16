"use client"

import { useActionState } from "react"
import { toast } from "sonner"
import type { ReviewFormState } from "@/app/(app)/review/actions"
import { updateReviewCycleAction } from "@/app/(app)/review/actions"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import type { ReviewCycleResponse } from "@/lib/api/types/review-types"
import { FORM_CONSTRAINTS } from "@/lib/form/constraints"

type Props = {
  cycle: ReviewCycleResponse
}

const initialState: ReviewFormState = { ok: false, error: null }

// 評価サイクルの編集フォーム（特権ロール向け）。題目・対象期間・締切日を native form で更新する。
// 成功・失敗の通知は action の結果を見て toast() で出す（useEffect は使わない）。
export function ReviewCycleEditForm(props: Props) {
  const action = useActionState(async (previousState: ReviewFormState, formData: FormData) => {
    const next = await updateReviewCycleAction(previousState, formData)

    if (next.ok) {
      toast.success("評価サイクルを更新しました")
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
      <input type="hidden" name="cycle_id" value={props.cycle.id} />

      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={`review-cycle-title-${props.cycle.id}`}>タイトル</FieldLabel>

          <Input
            id={`review-cycle-title-${props.cycle.id}`}
            name="title"
            defaultValue={props.cycle.title}
            maxLength={FORM_CONSTRAINTS.review.titleMax}
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor={`review-cycle-period-${props.cycle.id}`}>対象期間</FieldLabel>

          <Input
            id={`review-cycle-period-${props.cycle.id}`}
            name="period"
            defaultValue={props.cycle.period}
            maxLength={FORM_CONSTRAINTS.review.periodMax}
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor={`review-cycle-due-date-${props.cycle.id}`}>締切日</FieldLabel>

          <Input
            id={`review-cycle-due-date-${props.cycle.id}`}
            name="due_date"
            type="date"
            defaultValue={props.cycle.due_date ?? ""}
          />
        </Field>

        {state.error !== null ? <FieldError>{state.error}</FieldError> : null}

        <Field orientation="horizontal">
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending ? "更新中..." : "更新する"}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
