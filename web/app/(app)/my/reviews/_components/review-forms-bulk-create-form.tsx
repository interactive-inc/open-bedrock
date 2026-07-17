"use client"

import { useActionState } from "react"
import { toast } from "sonner"
import type { ReviewFormState } from "@/app/(app)/my/reviews/actions"
import { createReviewFormsBulkAction } from "@/app/(app)/my/reviews/actions"
import { toReviewerTypeLabel } from "@/app/(app)/my/reviews/_lib/to-reviewer-type-label"
import type { ReviewCycleResponse } from "@/lib/api/types/review-types"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"

type Props = {
  cycles: Array<ReviewCycleResponse>
}

const initialState: ReviewFormState = { ok: false, error: null }

const REVIEWER_TYPES = ["self", "manager", "peer", "subordinate"] as const

// 評価フォームの一括作成フォーム（360度評価・特権ロール向け）。
// サイクル・被評価者・評価者・評価者種別を選び、1 件のフォームを作成する。作成直後は本人非公開（hidden）。
export function ReviewFormsBulkCreateForm(props: Props) {
  const action = useActionState(async (previousState: ReviewFormState, formData: FormData) => {
    const next = await createReviewFormsBulkAction(previousState, formData)

    if (next.ok) {
      toast.success("評価フォームを作成しました")
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
          <FieldLabel htmlFor="bulk-cycle-id">評価サイクル</FieldLabel>

          <NativeSelect id="bulk-cycle-id" name="cycle_id" required className="w-full">
            <NativeSelectOption value="">選択してください</NativeSelectOption>

            {props.cycles.map((cycle) => (
              <NativeSelectOption key={cycle.id} value={String(cycle.id)}>
                {cycle.title}（{cycle.period}）
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>

        <Field>
          <FieldLabel htmlFor="bulk-subject-employee-id">被評価者の社員 ID</FieldLabel>

          <Input
            id="bulk-subject-employee-id"
            name="subject_employee_id"
            type="number"
            min={1}
            step={1}
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="bulk-reviewer-employee-id">評価者の社員 ID</FieldLabel>

          <Input
            id="bulk-reviewer-employee-id"
            name="reviewer_employee_id"
            type="number"
            min={1}
            step={1}
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="bulk-reviewer-type">評価者種別</FieldLabel>

          <NativeSelect id="bulk-reviewer-type" name="reviewer_type" required className="w-full">
            {REVIEWER_TYPES.map((type) => (
              <NativeSelectOption key={type} value={type}>
                {toReviewerTypeLabel(type)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>

        {state.error !== null ? <FieldError>{state.error}</FieldError> : null}

        <Field orientation="horizontal">
          <Button type="submit" disabled={isPending}>
            {isPending ? "作成中..." : "評価フォームを作成"}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
