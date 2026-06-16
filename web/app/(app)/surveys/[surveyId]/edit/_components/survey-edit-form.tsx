"use client"

import { useActionState } from "react"
import { toast } from "sonner"
import { updateSurveyAction } from "@/app/(app)/surveys/manage/actions"
import type { SurveyFormState } from "@/app/(app)/surveys/manage/actions"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"
import { FORM_CONSTRAINTS } from "@/lib/form/constraints"

type Props = {
  id: number
  title: string
  status: "open" | "closed"
  questionsJsonText: string
}

const initialState: SurveyFormState = { ok: false, error: null }

/**
 * アンケート編集フォーム。Dialog から /surveys/[surveyId]/edit ページへ昇格させたもの。
 */
export function SurveyEditForm(props: Props) {
  const action = useActionState(async (previousState: SurveyFormState, formData: FormData) => {
    const next = await updateSurveyAction(previousState, formData)

    if (next.ok) {
      toast.success("アンケートを更新しました")
    } else if (next.error !== null) {
      toast.error(next.error)
    }

    return next
  }, initialState)

  const state = action[0]

  const formAction = action[1]

  const isPending = action[2]

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={props.id} />

      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="edit-survey-title">タイトル</FieldLabel>

          <Input
            id="edit-survey-title"
            name="title"
            defaultValue={props.title}
            maxLength={FORM_CONSTRAINTS.survey.titleMax}
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="edit-survey-status">状態</FieldLabel>

          <NativeSelect
            id="edit-survey-status"
            name="status"
            defaultValue={props.status}
            className="w-full"
          >
            <NativeSelectOption value="open">実施中</NativeSelectOption>

            <NativeSelectOption value="closed">終了</NativeSelectOption>
          </NativeSelect>
        </Field>

        <Field>
          <FieldLabel htmlFor="edit-survey-questions">設問（JSON 配列・任意）</FieldLabel>

          <Textarea
            id="edit-survey-questions"
            name="questions_json"
            defaultValue={props.questionsJsonText}
            rows={10}
          />
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
