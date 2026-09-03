"use client"

import { useRouter } from "next/navigation"
import { useActionState } from "react"
import { toast } from "sonner"
import { createItIncidentAction } from "@/app/(app)/it-incident/it-incidents/actions"
import type { ItIncidentActionState } from "@/app/(app)/it-incident/it-incidents/actions"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

const initialState: ItIncidentActionState = { ok: false, error: null }

/** インシデント記録フォーム。発生日時・タイトル・概要が必須。成功時は /it-incidents へ戻る。 */
export function ItIncidentCreateForm() {
  const router = useRouter()

  async function reduce(
    previousState: ItIncidentActionState,
    formData: FormData,
  ): Promise<ItIncidentActionState> {
    const result = await createItIncidentAction(previousState, formData)

    if (result.ok) {
      toast.success("インシデントを記録しました")

      router.push("/it-incident/it-incidents")
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
          <FieldLabel htmlFor="incident-occurred-at">発生日時</FieldLabel>

          <Input id="incident-occurred-at" name="occurred_at" type="datetime-local" required />
        </Field>

        <Field>
          <FieldLabel htmlFor="incident-title">タイトル</FieldLabel>

          <Input id="incident-title" name="title" required />
        </Field>

        <Field>
          <FieldLabel htmlFor="incident-summary">概要</FieldLabel>

          <Textarea id="incident-summary" name="summary" rows={5} required />
        </Field>

        <Field>
          <FieldLabel htmlFor="incident-severity">深刻度（任意）</FieldLabel>

          <select
            id="incident-severity"
            name="severity"
            defaultValue=""
            className="h-8 w-full min-w-0 rounded-2xl border border-transparent bg-input/50 px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
          >
            <option value="">未設定</option>
            <option value="low">低</option>
            <option value="medium">中</option>
            <option value="high">高</option>
            <option value="critical">重大</option>
          </select>
        </Field>

        {state.error !== null ? <FieldError>{state.error}</FieldError> : null}

        <Field orientation="horizontal">
          <Button type="submit" disabled={isPending}>
            {isPending ? "記録中..." : "インシデントを記録"}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
