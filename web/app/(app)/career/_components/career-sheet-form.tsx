"use client"

import { useActionState } from "react"
import { toast } from "sonner"
import { updateCareerSheetAction } from "@/app/(app)/career/actions"
import type { CareerSheetFormState } from "@/app/(app)/career/actions"
import type { CareerSheet } from "@/lib/api/types/career-types"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import { FORM_CONSTRAINTS } from "@/lib/form/constraints"

type Props = {
  sheet: CareerSheet
}

const initialState: CareerSheetFormState = { ok: false, error: null }

// 本人のキャリアシート編集フォーム。useActionState で更新 Server Action を呼ぶ。
// reducer 内で Server Action を 1 回だけ実行し、その結果で toast() する（useEffect は使わない）。
export function CareerSheetForm(props: Props) {
  // useActionState の reducer。Server Action を実行し結果をそのまま次の state にする。
  async function reduce(
    previousState: CareerSheetFormState,
    formData: FormData,
  ): Promise<CareerSheetFormState> {
    const result = await updateCareerSheetAction(previousState, formData)

    if (result.ok) {
      toast.success("キャリアシートを保存しました")
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
          <FieldLabel htmlFor="goals_text">キャリア目標</FieldLabel>

          <Textarea
            id="goals_text"
            name="goals_text"
            rows={4}
            maxLength={FORM_CONSTRAINTS.career.sheetTextMax}
            defaultValue={props.sheet.goals_text ?? ""}
            placeholder="今後めざしたい役割やキャリアの方向性"
          />

          <FieldDescription>中長期で実現したいキャリアを記述します。</FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="strengths_text">強み・得意領域</FieldLabel>

          <Textarea
            id="strengths_text"
            name="strengths_text"
            rows={4}
            maxLength={FORM_CONSTRAINTS.career.sheetTextMax}
            defaultValue={props.sheet.strengths_text ?? ""}
            placeholder="活かせるスキルや経験"
          />

          <FieldDescription>自身の強みや得意な領域を記述します。</FieldDescription>
        </Field>

        {state.error !== null ? <FieldError>{state.error}</FieldError> : null}

        <Field orientation="horizontal">
          <Button type="submit" disabled={isPending}>
            {isPending ? "保存中..." : "保存する"}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
