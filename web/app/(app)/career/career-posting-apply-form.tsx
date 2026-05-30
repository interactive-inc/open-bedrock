"use client"

import { useActionState } from "react"
import { toast } from "sonner"
import { applyCareerPostingAction } from "@/app/(app)/career/actions"
import type { CareerApplyFormState } from "@/app/(app)/career/actions"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"

type Props = {
  postingId: number
  postingTitle: string
}

const initialState: CareerApplyFormState = { ok: false, error: null }

// 1 件の社内公募に対する応募フォーム。任意の応募メッセージを添えて送信する。
// reducer 内で Server Action を 1 回だけ実行し、その結果で toast() する（useEffect は使わない）。
export function CareerPostingApplyForm(props: Props) {
  // useActionState の reducer。Server Action を実行し結果をそのまま次の state にする。
  async function reduce(
    previousState: CareerApplyFormState,
    formData: FormData,
  ): Promise<CareerApplyFormState> {
    const result = await applyCareerPostingAction(previousState, formData)

    if (result.ok) {
      toast.success(`「${props.postingTitle}」に応募しました`)
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
        <input type="hidden" name="posting_id" value={props.postingId} />

        <Field>
          <FieldLabel htmlFor={`message-${props.postingId}`}>応募メッセージ（任意）</FieldLabel>

          <Textarea
            id={`message-${props.postingId}`}
            name="message"
            rows={3}
            placeholder="志望理由や活かせる経験など"
          />
        </Field>

        {state.error !== null ? <FieldError>{state.error}</FieldError> : null}

        <Field orientation="horizontal">
          <Button type="submit" size="sm" disabled={isPending || state.ok}>
            {state.ok ? "応募済み" : isPending ? "応募中..." : "この公募に応募"}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
