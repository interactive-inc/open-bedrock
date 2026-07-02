"use client"

import { useRouter } from "next/navigation"
import { useActionState, useState } from "react"
import { toast } from "sonner"
import { sendThanksAction } from "@/app/(app)/thanks/actions"
import type { ThanksActionState } from "@/app/(app)/thanks/actions"
import { searchRecipientsAction } from "@/app/(app)/thanks/search-recipients-action"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { EmployeeCombobox } from "@/components/ui/employee-combobox"
import type { EmployeeListItem } from "@/lib/api/types/employee-list-item"

const initialState: ThanksActionState = { ok: false, error: null }

// 感謝の送付フォーム。useActionState で sendThanksAction を呼び、結果を sonner で通知する。
// reducer 内で Server Action を 1 回だけ実行し、その結果で toast() する（useEffect は使わない）。
export function ThanksCreateForm() {
  const router = useRouter()

  const [recipient, setRecipient] = useState<EmployeeListItem | null>(null)

  // useActionState の reducer。送り先未選択ならここで弾き、選択済みなら Server Action を実行する。
  async function reduce(
    previousState: ThanksActionState,
    formData: FormData,
  ): Promise<ThanksActionState> {
    if (recipient === null) {
      const blocked: ThanksActionState = { ok: false, error: "送り先の従業員を選択してください" }
      toast.error(blocked.error)
      return blocked
    }

    const result = await sendThanksAction(previousState, formData)

    if (result.ok) {
      toast.success("感謝を送りました")

      router.push("/thanks")
      setRecipient(null)
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

          <EmployeeCombobox
            id="thanks-recipient"
            value={recipient}
            onValueChange={setRecipient}
            searchEmployees={searchRecipientsAction}
            placeholder="名前またはコードで検索"
            disabled={isPending}
          />

          <input type="hidden" name="recipient_employee_code" value={recipient?.code ?? ""} />

          <FieldDescription>
            感謝を送る相手を名前またはコードで検索して選びます。送り主は自分が設定されます。
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

        <Field>
          <FieldLabel htmlFor="thanks-points">ポイント（任意）</FieldLabel>

          <Input
            id="thanks-points"
            name="points"
            type="number"
            min={0}
            step={1}
            placeholder="0"
            disabled={isPending}
          />

          <FieldDescription>
            当月の贈与原資から相手へ贈るサンクスポイント。空欄ならメッセージのみの感謝になります。
          </FieldDescription>
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
