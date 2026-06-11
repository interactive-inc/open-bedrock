"use client"

import { useActionState } from "react"
import { toast } from "sonner"
import { createSurveyAction } from "@/app/(app)/surveys/manage/actions"
import type { SurveyFormState } from "@/app/(app)/surveys/manage/actions"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"

const initialState: SurveyFormState = { ok: false, error: null }

// アンケート登録フォーム。タイトル・状態・設問 JSON を native form で送る。
// 成功・失敗の通知は action の結果を見て toast() で出す（useEffect は使わない）。
export function SurveyCreateForm() {
  async function reduce(
    previousState: SurveyFormState,
    formData: FormData,
  ): Promise<SurveyFormState> {
    const result = await createSurveyAction(previousState, formData)

    if (result.ok) {
      toast.success("アンケートを作成しました")
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

          <Input id="survey-title" name="title" placeholder="従業員満足度サーベイ" required />
        </Field>

        <Field>
          <FieldLabel htmlFor="survey-status">状態</FieldLabel>

          <NativeSelect id="survey-status" name="status" defaultValue="open" className="w-full">
            <NativeSelectOption value="open">実施中</NativeSelectOption>

            <NativeSelectOption value="closed">終了</NativeSelectOption>
          </NativeSelect>
        </Field>

        <Field>
          <FieldLabel htmlFor="survey-questions">設問（JSON 配列・任意）</FieldLabel>

          <Textarea
            id="survey-questions"
            name="questions_json"
            placeholder='[{ "id": "q1", "type": "text", "text": "ご意見をお書きください" }]'
            rows={6}
          />
        </Field>

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
