"use client"

import { useActionState } from "react"
import { toast } from "sonner"
import { sendThanksAction } from "@/app/(app)/thanks/actions"
import type { ThanksActionState } from "@/app/(app)/thanks/actions"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

const initialState: ThanksActionState = { ok: false, error: null }

// 感謝の送付フォーム。useActionState で sendThanksAction を呼び、結果を sonner で通知する。
// reducer 内で Server Action を 1 回だけ実行し、その結果で toast() する（useEffect は使わない）。
export function ThanksCreateForm() {
  // useActionState の reducer。Server Action を実行し結果をそのまま次の state にする。
  async function reduce(
    previousState: ThanksActionState,
    formData: FormData,
  ): Promise<ThanksActionState> {
    const result = await sendThanksAction(previousState, formData)

    if (result.ok) {
      toast.success("感謝を送りました")
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
    <form action={formAction} className="flex flex-col gap-4 rounded-2xl border p-4">
      <h2 className="text-lg font-medium">感謝を送る</h2>

      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="thanks-recipient">送り先</FieldLabel>

          <Input id="thanks-recipient" name="recipient_employee_code" placeholder="E005" required />

          <FieldDescription>
            感謝を送る相手の従業員コード。送り主は自分が設定されます。
          </FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="thanks-message">メッセージ</FieldLabel>

          <Textarea
            id="thanks-message"
            name="message"
            placeholder="伝えたい感謝の気持ち"
            rows={3}
            required
          />
        </Field>

        {state.error !== null ? <FieldError>{state.error}</FieldError> : null}

        <Field orientation="horizontal">
          <Button type="submit" disabled={isPending}>
            {isPending ? "送信中..." : "送る"}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
