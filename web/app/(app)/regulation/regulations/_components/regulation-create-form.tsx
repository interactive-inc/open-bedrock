"use client"

import { useActionState } from "react"
import { registerRegulationAction } from "@/app/(app)/regulation/regulations/actions"
import type { RegulationActionState } from "@/app/(app)/regulation/regulations/actions"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

const initialState: RegulationActionState = { ok: false, error: null }

/**
 * 規程を初版付きで新規登録するフォーム。管理者のみ表示される。
 */
export function RegulationCreateForm() {
  const action = useActionState(registerRegulationAction, initialState)

  const state = action[0]

  const formAction = action[1]

  const pending = action[2]

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-lg bg-card border p-4">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="regulation_code">コード</FieldLabel>

          <Input id="regulation_code" name="code" />
        </Field>

        <Field>
          <FieldLabel htmlFor="regulation_title">タイトル</FieldLabel>

          <Input id="regulation_title" name="title" />
        </Field>

        <Field>
          <FieldLabel htmlFor="regulation_category">カテゴリ（任意）</FieldLabel>

          <Input id="regulation_category" name="category" />
        </Field>

        <Field>
          <FieldLabel htmlFor="regulation_effective_on">施行日</FieldLabel>

          <Input id="regulation_effective_on" name="effective_on" type="date" />
        </Field>

        <Field>
          <FieldLabel htmlFor="regulation_body">本文（Markdown）</FieldLabel>

          <Textarea id="regulation_body" name="body_md" rows={8} />
        </Field>

        <Field>
          <FieldLabel htmlFor="regulation_note">備考（任意）</FieldLabel>

          <Input id="regulation_note" name="note" />
        </Field>
      </FieldGroup>

      {state.error === null ? null : <FieldError>{state.error}</FieldError>}

      {state.ok ? <p className="text-sm text-muted-foreground">規程を登録しました</p> : null}

      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "登録中..." : "規程を登録"}
      </Button>
    </form>
  )
}
