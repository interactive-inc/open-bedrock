"use client"

import { useActionState } from "react"
import { submitApplicationAction } from "@/app/(app)/applications/templates/[code]/actions"
import type { SubmitState } from "@/app/(app)/applications/templates/[code]/actions"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"

type Props = {
  templateCode: string
}

const initialState: SubmitState = { ok: false, error: null }

// 申請提出フォーム。payload は JSON テキストで受け、useActionState で Server Action を呼ぶ。
export function SubmitApplicationForm(props: Props) {
  const action = useActionState(submitApplicationAction, initialState)

  const state = action[0]

  const formAction = action[1]

  const isPending = action[2]

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="template_code" value={props.templateCode} />

      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="payload">申請内容 (JSON)</FieldLabel>

          <Textarea
            id="payload"
            name="payload"
            rows={10}
            placeholder='{ "reason": "..." }'
            aria-invalid={state.error !== null}
          />

          <FieldDescription>
            テンプレートのスキーマに沿った内容を JSON で入力してください
          </FieldDescription>

          {state.error !== null ? <FieldError>{state.error}</FieldError> : null}
        </Field>
      </FieldGroup>

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "提出中..." : "提出する"}
        </Button>
      </div>
    </form>
  )
}
