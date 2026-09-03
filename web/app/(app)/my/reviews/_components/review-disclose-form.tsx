"use client"

import { useActionState } from "react"
import { toast } from "sonner"
import type { ReviewFormState } from "@/app/(app)/my/reviews/actions"
import { discloseReviewCycleAction } from "@/app/(app)/my/reviews/actions"
import type { ReviewCycleResponse } from "@/lib/api/types/review-types"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"

type Props = {
  cycles: Array<ReviewCycleResponse>
}

const initialState: ReviewFormState = { ok: false, error: null }

/** 評価フォームの一括開示フォーム（特権ロール向け）。サイクルを選び、その全フォームを本人に開示する。 */
export function ReviewDiscloseForm(props: Props) {
  const action = useActionState(async (previousState: ReviewFormState, formData: FormData) => {
    const next = await discloseReviewCycleAction(previousState, formData)

    if (next.ok) {
      toast.success("評価フォームを開示しました")
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
          <FieldLabel htmlFor="disclose-cycle-id">評価サイクル</FieldLabel>

          <NativeSelect id="disclose-cycle-id" name="cycle_id" required className="w-full">
            <NativeSelectOption value="">選択してください</NativeSelectOption>

            {props.cycles.map((cycle) => (
              <NativeSelectOption key={cycle.id} value={String(cycle.id)}>
                {cycle.title}（{cycle.period}）
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>

        {state.error !== null ? <FieldError>{state.error}</FieldError> : null}

        <Field orientation="horizontal">
          <Button type="submit" variant="secondary" disabled={isPending}>
            {isPending ? "開示中..." : "サイクルを一括開示"}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
