"use client"

import { useRouter } from "next/navigation"
import { useActionState } from "react"
import { toast } from "sonner"
import { createSurveyAction } from "@/app/(app)/organization/surveys/manage/actions"
import type { SurveyFormState } from "@/app/(app)/organization/surveys/manage/actions"
import { QuestionBuilder } from "@/app/(app)/organization/surveys/_components/question-builder"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { FORM_CONSTRAINTS } from "@/lib/form/constraints"

const initialState: SurveyFormState = { ok: false, error: null }

/**
 * アンケート登録フォーム。タイトル・状態・設問 JSON を native form で送る。
 * 成功・失敗の通知は action の結果を見て toast() で出す（useEffect は使わない）。
 */
export function SurveyCreateForm() {
  const router = useRouter()

  async function reduce(
    previousState: SurveyFormState,
    formData: FormData,
  ): Promise<SurveyFormState> {
    const result = await createSurveyAction(previousState, formData)

    if (result.ok) {
      toast.success("アンケートを作成しました")

      router.push("/organization/surveys/manage")
    } else if (result.error !== null) {
      toast.error(result.error)
    }

    return result
  }

  const action = useActionState(reduce, initialState)

  const state = action[0]

  const formAction = action[1]

  const isPending = action[2]

  return (
    <form action={formAction}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="survey-title">タイトル</FieldLabel>

          <Input
            id="survey-title"
            name="title"
            placeholder="従業員満足度サーベイ"
            maxLength={FORM_CONSTRAINTS.survey.titleMax}
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="survey-status">状態</FieldLabel>

          <NativeSelect id="survey-status" name="status" defaultValue="open" className="w-full">
            <NativeSelectOption value="open">実施中</NativeSelectOption>

            <NativeSelectOption value="closed">終了</NativeSelectOption>
          </NativeSelect>
        </Field>

        <QuestionBuilder />

        {state.error !== null ? <FieldError>{state.error}</FieldError> : null}

        <Field orientation="horizontal">
          <Button type="submit" disabled={isPending}>
            {isPending ? "作成中..." : "アンケートを作成"}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
