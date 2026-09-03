"use client"

import { useActionState } from "react"
import { createAnnouncementAction } from "@/app/(app)/announcement/announcements/actions"
import type { AnnouncementActionState } from "@/app/(app)/announcement/announcements/actions"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

const initialState: AnnouncementActionState = { ok: false, error: null }

/**
 * 社内アナウンスを下書き作成するフォーム。管理者のみ表示される。
 */
export function AnnouncementCreateForm() {
  const action = useActionState(createAnnouncementAction, initialState)

  const state = action[0]

  const formAction = action[1]

  const pending = action[2]

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-lg bg-card border p-4">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="announcement_title">タイトル</FieldLabel>

          <Input id="announcement_title" name="title" />
        </Field>

        <Field>
          <FieldLabel htmlFor="announcement_body">本文（Markdown）</FieldLabel>

          <Textarea id="announcement_body" name="body_md" rows={8} />
        </Field>
      </FieldGroup>

      {state.error === null ? null : <FieldError>{state.error}</FieldError>}

      {state.ok ? <p className="text-sm text-muted-foreground">下書きを作成しました</p> : null}

      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "作成中..." : "下書きを作成"}
      </Button>
    </form>
  )
}
