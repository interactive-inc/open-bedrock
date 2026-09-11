"use client"

import { useState, useRef } from "react"
import {
  withdrawKnowledgeAction,
  updateKnowledgeAction,
} from "@/app/(app)/knowledge/knowledge-articles/actions"
import { useFormAction } from "@/hooks/use-form-action"
import { Button } from "@/components/ui/button"
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

/** ナレッジ記事詳細の操作群。編集（Dialog フォーム）と取下げボタンを並べる。 */
export function KnowledgeDetailActions(props: Props) {
  return (
    <div className="flex items-center gap-2">
      <EditKnowledgeDialog
        key={`${props.article.id}:${props.article.revision}`}
        article={props.article}
      />

      <WithdrawKnowledgeButton
        key={`withdraw:${props.article.id}:${props.article.revision}`}
        article={props.article}
      />
    </div>
  )
}

/** 記事編集フォームを Dialog で開く。タイトル・カテゴリ・タグ・本文を編集して送信する。 */
function EditKnowledgeDialog(props: { article: KnowledgeDetailResponse }) {
  const [open, setOpen] = useState(false)
  const commandId = useRef<string | null>(null)

  const [state, formAction, pending] = useFormAction(
    updateKnowledgeAction,
    { ok: false, error: null },
    "記事を変更しました",
    { onSuccess: () => setOpen(false) },
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="secondary" size="sm" />}>編集</DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>記事を編集</DialogTitle>

          <DialogDescription>作成者のみ変更できます。</DialogDescription>
        </DialogHeader>

        <form
          action={(data) => {
            commandId.current ??= crypto.randomUUID()
            data.set("command_id", commandId.current)
            formAction(data)
          }}
          onChange={() => {
            commandId.current = null
          }}
          className="flex flex-col gap-4"
        >
          <input type="hidden" name="article_id" value={props.article.id} />
          <input type="hidden" name="revision" value={props.article.revision} />

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="edit_reason">変更理由</FieldLabel>
              <Input disabled={pending} id="edit_reason" name="reason" required maxLength={2000} />
            </Field>
            <Field>
              <FieldLabel htmlFor="edit_title">タイトル</FieldLabel>

              <Input
                disabled={pending}
                id="edit_title"
                name="title"
                defaultValue={props.article.title}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="edit_category">カテゴリ</FieldLabel>

              <Input
                disabled={pending}
                id="edit_category"
                name="category"
                defaultValue={props.article.category}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="edit_tags">タグ（カンマ区切り）</FieldLabel>

              <Input
                disabled={pending}
                id="edit_tags"
                name="tags"
                defaultValue={props.article.tags ?? ""}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="edit_body">本文（Markdown）</FieldLabel>

              <Textarea
                disabled={pending}
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

/** 記事取下げボタン。Server Action を呼び、成功時は一覧が revalidate される。 */
function WithdrawKnowledgeButton(props: { article: KnowledgeDetailResponse }) {
  const [open, setOpen] = useState(false)
  const commandId = useRef<string | null>(null)
  const [state, formAction, pending] = useFormAction(
    withdrawKnowledgeAction,
    {
      ok: false,
      error: null,
    },
    "記事を取下げました",
    { onSuccess: () => setOpen(false) },
  )

  return (
    <div className="flex flex-col gap-2">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger render={<Button variant="destructive" size="sm" disabled={pending} />}>
          取下げ
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>この記事を取下げますか？</DialogTitle>
            <DialogDescription>
              通常の一覧から外します。本文と改訂履歴は残ります。
            </DialogDescription>
          </DialogHeader>
          <form
            className="flex flex-col gap-4"
            action={(data) => {
              commandId.current ??= crypto.randomUUID()
              data.set("command_id", commandId.current)
              formAction(data)
            }}
          >
            <input type="hidden" name="article_id" value={props.article.id} />
            <input type="hidden" name="revision" value={props.article.revision} />
            <Field>
              <FieldLabel htmlFor="withdraw_reason">取下げ理由</FieldLabel>
              <Input
                disabled={pending}
                id="withdraw_reason"
                name="reason"
                required
                maxLength={2000}
                onChange={() => {
                  commandId.current = null
                }}
              />
            </Field>
            {state.error === null ? null : <FieldError>{state.error}</FieldError>}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={() => setOpen(false)}
              >
                やめる
              </Button>
              <Button type="submit" variant="destructive" disabled={pending}>
                記事を取下げ
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
