"use client"

import { useActionState, useState } from "react"
import { createKnowledgeAction } from "@/app/(app)/knowledge/actions"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

// ナレッジ記事を新規作成する Dialog フォーム。タイトル・カテゴリ・タグ・本文を入力して送信する。
export function KnowledgeCreateForm() {
  const [open, setOpen] = useState(false)

  const [state, formAction, pending] = useActionState(createKnowledgeAction, {
    ok: false,
    error: null,
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>記事を作成</DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>ナレッジ記事を作成</DialogTitle>

          <DialogDescription>タイトル・カテゴリ・本文は必須です。</DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="create_title">タイトル</FieldLabel>

              <Input id="create_title" name="title" />
            </Field>

            <Field>
              <FieldLabel htmlFor="create_category">カテゴリ</FieldLabel>

              <Input id="create_category" name="category" />
            </Field>

            <Field>
              <FieldLabel htmlFor="create_tags">タグ（カンマ区切り）</FieldLabel>

              <Input id="create_tags" name="tags" />
            </Field>

            <Field>
              <FieldLabel htmlFor="create_body">本文（Markdown）</FieldLabel>

              <Textarea id="create_body" name="body_md" rows={8} />
            </Field>
          </FieldGroup>

          {state.error === null ? null : <p className="text-sm text-destructive">{state.error}</p>}

          <Button type="submit" disabled={pending}>
            作成
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
