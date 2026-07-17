"use client"

import { useActionState } from "react"
import { useRouter } from "next/navigation"
import { createMeetingAction } from "@/app/(app)/organization/meetings/actions"
import type { MeetingActionState } from "@/app/(app)/organization/meetings/actions"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

const initialState: MeetingActionState = { ok: false, error: null }

/**
 * 会議体を新規登録するフォーム。成功時は /meetings に遷移する。
 */
export function MeetingNewForm() {
  const router = useRouter()

  async function reduce(
    previousState: MeetingActionState,
    formData: FormData,
  ): Promise<MeetingActionState> {
    const result = await createMeetingAction(previousState, formData)

    if (result.ok) {
      router.push("/organization/meetings")
    }

    return result
  }

  const action = useActionState(reduce, initialState)

  const state = action[0]

  const formAction = action[1]

  const pending = action[2]

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="create_code">コード</FieldLabel>

          <Input id="create_code" name="code" />
        </Field>

        <Field>
          <FieldLabel htmlFor="create_name">名称</FieldLabel>

          <Input id="create_name" name="name" />
        </Field>

        <Field>
          <FieldLabel htmlFor="create_cadence">開催頻度（例: 週次・月次）</FieldLabel>

          <Input id="create_cadence" name="cadence" />
        </Field>

        <Field>
          <FieldLabel htmlFor="create_description">説明</FieldLabel>

          <Textarea id="create_description" name="description" rows={4} />
        </Field>
      </FieldGroup>

      {state.error === null ? null : <FieldError>{state.error}</FieldError>}

      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "登録中..." : "登録"}
      </Button>
    </form>
  )
}
