"use client"

import { useActionState } from "react"
import { useRouter } from "next/navigation"
import { createCommendationAction } from "@/app/(app)/commendation/commendations/actions"
import type { CommendationActionState } from "@/app/(app)/commendation/commendations/actions"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

const initialState: CommendationActionState = { ok: false, error: null }

/**
 * 表彰を記録するフォーム。従業員ID・タイトル・理由・表彰日を入力する。
 * 成功時は一覧を再取得する。commendation:manage を持つ利用者だけに表示する。
 */
export function CommendationNewForm() {
  const router = useRouter()

  async function reduce(
    previousState: CommendationActionState,
    formData: FormData,
  ): Promise<CommendationActionState> {
    const result = await createCommendationAction(previousState, formData)

    if (result.ok) {
      router.refresh()
    }

    return result
  }

  const action = useActionState(reduce, initialState)

  const state = action[0]

  const formAction = action[1]

  const pending = action[2]

  return (
    <Card className="gap-0">
      <form action={formAction} className="flex flex-col gap-4 p-4">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="commendation_employee_id">従業員ID</FieldLabel>

            <Input id="commendation_employee_id" name="employee_id" type="number" min={1} />
          </Field>

          <Field>
            <FieldLabel htmlFor="commendation_title">タイトル</FieldLabel>

            <Input id="commendation_title" name="title" />
          </Field>

          <Field>
            <FieldLabel htmlFor="commendation_reason">理由</FieldLabel>

            <Textarea id="commendation_reason" name="reason" rows={3} />
          </Field>

          <Field>
            <FieldLabel htmlFor="commendation_awarded_on">表彰日</FieldLabel>

            <Input id="commendation_awarded_on" name="awarded_on" type="date" />
          </Field>
        </FieldGroup>

        {state.error === null ? null : <FieldError>{state.error}</FieldError>}

        <Button type="submit" disabled={pending}>
          {pending ? "記録中..." : "表彰を記録"}
        </Button>
      </form>
    </Card>
  )
}
