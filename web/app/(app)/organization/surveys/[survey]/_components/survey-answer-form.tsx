"use client"

import { useActionState } from "react"
import { toast } from "sonner"
import {
  submitSurveyResponseAction,
  type SubmitSurveyResponseState,
} from "@/app/(app)/organization/surveys/actions"
import type { SurveyQuestion } from "@/lib/api/types/survey-types"
import { EmptyState } from "@/components/empty-state"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { FORM_CONSTRAINTS } from "@/lib/form/constraints"

type Props = {
  surveyId: number
  questions: ReadonlyArray<SurveyQuestion>
}

const initialState: SubmitSurveyResponseState = {
  status: "idle",
  message: null,
}

/**
 * アンケート回答フォーム。native form + Server Action + useActionState。
 * 送信結果はトースト(sonner)とフォーム下部のメッセージで知らせる。
 */
export function SurveyAnswerForm(props: Props) {
  // タプルは index 参照（destructuring 禁止）。
  const actionState = useActionState(actionWithToast, initialState)

  const formState = actionState[0]

  const formAction = actionState[1]

  const isPending = actionState[2]

  if (props.questions.length === 0) {
    return <EmptyState title="このアンケートには設問がありません" />
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="surveyId" value={props.surveyId} />

      <FieldGroup>
        {props.questions.map((question) => (
          <Card key={question.id} className="p-0 gap-0">
            <div className="flex flex-col gap-3 p-4">
              <Field>
                <FieldLabel htmlFor={`answer:${question.id}`}>{question.text}</FieldLabel>

                {question.type === "text" ? (
                  <Textarea
                    id={`answer:${question.id}`}
                    name={`answer:${question.id}`}
                    rows={3}
                    maxLength={FORM_CONSTRAINTS.survey.answersJsonMax}
                  />
                ) : (
                  <Input
                    id={`answer:${question.id}`}
                    name={`answer:${question.id}`}
                    type={question.type === "scale" ? "number" : "text"}
                    inputMode={question.type === "scale" ? "numeric" : "text"}
                    maxLength={
                      question.type === "scale" ? undefined : FORM_CONSTRAINTS.survey.answersJsonMax
                    }
                  />
                )}
              </Field>
            </div>
          </Card>
        ))}

        {formState.status === "error" && formState.message !== null ? (
          <FieldError>{formState.message}</FieldError>
        ) : null}

        <Button type="submit" disabled={isPending} className="w-fit">
          {isPending ? "送信中..." : "回答を送信"}
        </Button>
      </FieldGroup>
    </form>
  )
}

/**
 * Server Action をラップし、結果に応じてトーストを出す。
 * useEffect を使わず送信完了時点で副作用を発火させるための薄いラッパ。
 */
async function actionWithToast(
  previousState: SubmitSurveyResponseState,
  formData: FormData,
): Promise<SubmitSurveyResponseState> {
  const nextState = await submitSurveyResponseAction(previousState, formData)

  if (nextState.status === "success" && nextState.message !== null) {
    toast.success(nextState.message)
  }

  if (nextState.status === "error" && nextState.message !== null) {
    toast.error(nextState.message)
  }

  return nextState
}
