"use client"

import { useActionState } from "react"
import { registerDocumentAction } from "@/app/(app)/document/documents/actions"
import type { DocumentActionState } from "@/app/(app)/document/documents/actions"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

const initialState: DocumentActionState = { ok: false, error: null }

/**
 * 文書台帳へメタデータを登録するフォーム。document:manage を持つ利用者にのみ表示される。
 */
export function DocumentRegisterForm() {
  const action = useActionState(registerDocumentAction, initialState)

  const state = action[0]

  const formAction = action[1]

  const pending = action[2]

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-lg bg-card border p-4">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="document_title">タイトル</FieldLabel>

          <Input id="document_title" name="title" />
        </Field>

        <Field>
          <FieldLabel htmlFor="document_location">所在（URL や保管場所）</FieldLabel>

          <Input id="document_location" name="location" />
        </Field>

        <Field>
          <FieldLabel htmlFor="document_category">分類（任意）</FieldLabel>

          <Input id="document_category" name="category" />
        </Field>

        <Field>
          <FieldLabel htmlFor="document_partner_code">取引先コード（任意）</FieldLabel>

          <Input id="document_partner_code" name="partner_code" />
        </Field>

        <Field>
          <FieldLabel htmlFor="document_expires_on">期限（任意）</FieldLabel>

          <Input id="document_expires_on" name="expires_on" type="date" />
        </Field>

        <Field>
          <FieldLabel htmlFor="document_note">備考（任意）</FieldLabel>

          <Input id="document_note" name="note" />
        </Field>
      </FieldGroup>

      {state.error === null ? null : <FieldError>{state.error}</FieldError>}

      {state.ok ? <p className="text-sm text-muted-foreground">文書を登録しました</p> : null}

      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "登録中..." : "文書を登録"}
      </Button>
    </form>
  )
}
