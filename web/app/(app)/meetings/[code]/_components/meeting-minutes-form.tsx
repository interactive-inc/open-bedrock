"use client"

import { useActionState } from "react"
import { useRouter } from "next/navigation"
import { createMeetingMinutesAction } from "@/app/(app)/meetings/actions"
import type { MeetingActionState } from "@/app/(app)/meetings/actions"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

type Props = {
  code: string
}

const initialState: MeetingActionState = { ok: false, error: null }

/**
 * 会議体配下に議事録を記録するフォーム。書けるのは全認証者。成功時は一覧を再取得する。
 */
export function MeetingMinutesForm(props: Props) {
  const router = useRouter()

  async function reduce(
    previousState: MeetingActionState,
    formData: FormData,
  ): Promise<MeetingActionState> {
    const result = await createMeetingMinutesAction(previousState, formData)

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
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="meeting_code" value={props.code} />

      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="minutes_held_on">開催日</FieldLabel>

          <Input id="minutes_held_on" name="held_on" type="date" />
        </Field>

        <Field>
          <FieldLabel htmlFor="minutes_title">タイトル</FieldLabel>

          <Input id="minutes_title" name="title" />
        </Field>

        <Field>
          <FieldLabel htmlFor="minutes_attendees">出席者</FieldLabel>

          <Input id="minutes_attendees" name="attendees" />
        </Field>

        <Field>
          <FieldLabel htmlFor="minutes_body">本文（Markdown）</FieldLabel>

          <Textarea id="minutes_body" name="body_md" rows={10} />
        </Field>
      </FieldGroup>

      {state.error === null ? null : <FieldError>{state.error}</FieldError>}

      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "記録中..." : "記録"}
      </Button>
    </form>
  )
}
