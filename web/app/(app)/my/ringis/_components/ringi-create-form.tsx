"use client"

import { useRouter } from "next/navigation"
import { useActionState } from "react"
import { toast } from "sonner"
import { submitRingiAction } from "@/app/(app)/my/ringis/actions"
import type { RingiSubmitFormState } from "@/app/(app)/my/ringis/actions"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

const initialState: RingiSubmitFormState = { ok: false, error: null }

/**
 * 稟議起案フォーム。承認者 ID・件名・金額・理由を native form で送る。
 * 成功・失敗の通知は action の結果を見て toast() で出す（useEffect は使わない）。
 * 成功時は自分の稟議一覧へ遷移し、起案がステータス付きで並んだことを見せる。
 */
export function RingiCreateForm() {
  const router = useRouter()

  async function reduce(
    previousState: RingiSubmitFormState,
    formData: FormData,
  ): Promise<RingiSubmitFormState> {
    const result = await submitRingiAction(previousState, formData)

    if (result.ok) {
      toast.success("稟議を起案しました")

      router.push("/my/ringis")
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
          <FieldLabel htmlFor="ringi-approver-id">承認者 ID</FieldLabel>

          <Input
            id="ringi-approver-id"
            name="approver_id"
            type="number"
            min={1}
            step={1}
            placeholder="例: 5"
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="ringi-title">件名</FieldLabel>

          <Input id="ringi-title" name="title" type="text" placeholder="件名を入力" required />
        </Field>

        <Field>
          <FieldLabel htmlFor="ringi-amount">金額（円）</FieldLabel>

          <Input
            id="ringi-amount"
            name="amount"
            type="number"
            min={1}
            step={1}
            placeholder="30000"
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="ringi-reason">理由</FieldLabel>

          <Textarea
            id="ringi-reason"
            name="reason"
            rows={4}
            placeholder="起案の背景や目的など"
            required
          />
        </Field>

        {state.error !== null ? <FieldError>{state.error}</FieldError> : null}

        <Field orientation="horizontal">
          <Button type="submit" disabled={isPending}>
            {isPending ? "起案中..." : "稟議を起案"}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
