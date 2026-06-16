"use client"

import { useActionState } from "react"
import { toast } from "sonner"
import type { ReviewFormState } from "@/app/(app)/review/actions"
import { submitReviewFormAction } from "@/app/(app)/review/actions"
import { toReviewerTypeLabel } from "@/app/(app)/review/_lib/to-reviewer-type-label"
import { EmptyState } from "@/components/empty-state"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { ReviewFormResponse } from "@/lib/api/types/review-types"
import { FORM_CONSTRAINTS } from "@/lib/form/constraints"

type Props = {
  forms: Array<ReviewFormResponse>
}

const initialState: ReviewFormState = { ok: false, error: null }

// 自分の評価フォーム一覧。pending のフォームにはスコア・コメントの提出フォームを出す。
// 提出の結果は action の戻り値を見て toast で通知する（useEffect は使わない）。
export function MyReviewForms(props: Props) {
  const submitAction = useActionState(
    async (previousState: ReviewFormState, formData: FormData) => {
      const next = await submitReviewFormAction(previousState, formData)

      if (next.ok) {
        toast.success("評価フォームを提出しました")
      } else if (next.error !== null) {
        toast.error(next.error)
      }

      return next
    },
    initialState,
  )

  const submitState = submitAction[0]

  const submitDispatch = submitAction[1]

  const isSubmitting = submitAction[2]

  if (props.forms.length === 0) {
    return <EmptyState title="割り当てられた評価フォームはありません" />
  }

  return (
    <div className="flex flex-col gap-3">
      {props.forms.map((form) => (
        <Card key={form.id}>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-medium">評価対象: 社員 #{form.subject_employee_id}</span>

                <Badge variant="outline">{toReviewerTypeLabel(form.reviewer_type)}</Badge>
              </div>

              {form.status === "submitted" ? (
                <Badge variant="secondary">提出済み</Badge>
              ) : (
                <Badge>未提出</Badge>
              )}
            </div>
          </CardHeader>

          <CardContent>
            {form.status === "submitted" ? (
              <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                <span>スコア: {form.score ?? "-"}</span>

                <span>提出日時: {form.submitted_at ?? "-"}</span>
              </div>
            ) : (
              <form action={submitDispatch} className="flex flex-col gap-4">
                <input type="hidden" name="form_id" value={form.id} />

                <Field>
                  <FieldLabel htmlFor={`review-form-score-${form.id}`}>スコア</FieldLabel>

                  <Input
                    id={`review-form-score-${form.id}`}
                    name="score"
                    type="number"
                    min={FORM_CONSTRAINTS.review.scoreMin}
                    max={FORM_CONSTRAINTS.review.scoreMax}
                    step={1}
                    placeholder="80"
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor={`review-form-comment-${form.id}`}>コメント</FieldLabel>

                  <Textarea
                    id={`review-form-comment-${form.id}`}
                    name="comment"
                    maxLength={FORM_CONSTRAINTS.review.commentMax}
                    placeholder="評価コメントを入力"
                  />
                </Field>

                <div>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "提出中..." : "提出する"}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
