"use client"

import { useState } from "react"
import {
  deleteKnowledgeAction,
  updateKnowledgeAction,
} from "@/app/(app)/organization/knowledge-articles/actions"
import { useFormAction } from "@/hooks/use-form-action"
import { Button } from "@/components/ui/button"
import { ConfirmActionDialog } from "@/components/confirm-action-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { KnowledgeDetailResponse } from "@/lib/api/types/knowledge-types"

type Props = {
  article: KnowledgeDetailResponse
}

// ナレッジ記事詳細の操作群。編集（Dialog フォーム）と削除ボタンを並べる。
export function KnowledgeDetailActions(props: Props) {
  return (
    <div className="flex items-center gap-2">
      <EditKnowledgeDialog article={props.article} />

      <DeleteKnowledgeButton articleId={props.article.id} />
    </div>
  )
}

// 記事編集フォームを Dialog で開く。タイトル・カテゴリ・タグ・本文を編集して送信する。
function EditKnowledgeDialog(props: { article: KnowledgeDetailResponse }) {
  const [open, setOpen] = useState(false)

  const [state, formAction, pending] = useFormAction(
    updateKnowledgeAction,
    { ok: false, error: null },
    "記事を変更しました",
    { onSuccess: () => setOpen(false) },
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>編集</DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>記事を編集</DialogTitle>

          <DialogDescription>作成者のみ変更できます。</DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="article_id" value={props.article.id} />

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="edit_title">タイトル</FieldLabel>

              <Input id="edit_title" name="title" defaultValue={props.article.title} />
            </Field>

            <Field>
              <FieldLabel htmlFor="edit_category">カテゴリ</FieldLabel>

              <Input id="edit_category" name="category" defaultValue={props.article.category} />
            </Field>

            <Field>
              <FieldLabel htmlFor="edit_tags">タグ（カンマ区切り）</FieldLabel>

              <Input id="edit_tags" name="tags" defaultValue={props.article.tags ?? ""} />
            </Field>

            <Field>
              <FieldLabel htmlFor="edit_body">本文（Markdown）</FieldLabel>

              <Textarea
                id="edit_body"
                name="body_md"
                rows={8}
                defaultValue={props.article.body_md}
              />
            </Field>
          </FieldGroup>

          {state.error === null ? null : <FieldError>{state.error}</FieldError>}

          <Button type="submit" disabled={pending}>
            変更を保存
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// 記事削除ボタン。Server Action を呼び、成功時は一覧が revalidate される。
function DeleteKnowledgeButton(props: { articleId: number }) {
  const [state, formAction, pending] = useFormAction(
    deleteKnowledgeAction,
    {
      ok: false,
      error: null,
    },
    "記事を削除しました",
  )

  return (
    <div className="flex flex-col gap-1">
      <ConfirmActionDialog
        action={formAction}
        triggerLabel="削除"
        title="この記事を削除しますか？"
        description="記事の内容は元に戻せません。"
        confirmLabel="記事を削除"
        pending={pending}
      >
        <input type="hidden" name="article_id" value={props.articleId} />
      </ConfirmActionDialog>

      {state.error === null ? null : <FieldError>{state.error}</FieldError>}
    </div>
  )
}
