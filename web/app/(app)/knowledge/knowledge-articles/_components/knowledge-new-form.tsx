"use client"

import { useRouter } from "next/navigation"
import { createKnowledgeAction } from "@/app/(app)/knowledge/knowledge-articles/actions"
import type { KnowledgeActionState } from "@/app/(app)/knowledge/knowledge-articles/actions"
import { useFormAction } from "@/hooks/use-form-action"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

const initialState: KnowledgeActionState = { ok: false, error: null }

/**
 * ナレッジ記事を新規作成する単独ページ用フォーム。成功時は /knowledge に遷移する。
 */
export function KnowledgeNewForm() {
  const router = useRouter()

  const action = useFormAction(createKnowledgeAction, initialState, "ナレッジを作成しました", {
    onSuccess: () => router.push("/knowledge/knowledge-articles"),
  })

  const state = action[0]

  const formAction = action[1]

  const pending = action[2]

  return (
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

          <Textarea id="create_body" name="body_md" rows={12} />
        </Field>
      </FieldGroup>

      {state.error === null ? null : <FieldError>{state.error}</FieldError>}

      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "作成中..." : "作成"}
      </Button>
    </form>
  )
}
