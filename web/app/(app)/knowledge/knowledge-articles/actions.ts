"use server"

import { revalidatePath } from "next/cache"
import { createKnowledge } from "@/lib/api/create-knowledge"
import { withdrawKnowledge } from "@/lib/api/withdraw-knowledge"
import { updateKnowledge } from "@/lib/api/update-knowledge"
import { toPositiveIntId } from "@/lib/form/to-positive-int-id"
import { requireAuth } from "@/lib/auth/require-auth"

/** useActionState で参照する共通の戻り値。ok=成功 / error=表示するエラー文言。 */
export type KnowledgeActionState = {
  ok: boolean
  error: string | null
}

/**
 * ナレッジ記事作成 Server Action。title/category/body_md 必須、tags は任意。
 * 成功時は /knowledge を revalidate する。
 */
export async function createKnowledgeAction(
  previousState: KnowledgeActionState,
  formData: FormData,
): Promise<KnowledgeActionState> {
  await requireAuth()
  const commandId = toText(formData.get("command_id"))
  const reason = toText(formData.get("reason"))
  if (commandId === null || reason === null)
    return { ok: false, error: "記録理由を入力し、内容を確認して送信してください" }

  const title = toText(formData.get("title"))

  const category = toText(formData.get("category"))

  const bodyMd = toText(formData.get("body_md"))

  if (title === null || category === null || bodyMd === null) {
    return { ok: false, error: "タイトル・カテゴリ・本文を入力してください" }
  }

  const created = await createKnowledge(
    {
      reason,
      title: title,
      category: category,
      tags: toText(formData.get("tags")),
      body_md: bodyMd,
    },
    commandId,
  )

  if (created instanceof Error) {
    return { ok: false, error: created.message }
  }

  revalidatePath("/knowledge/knowledge-articles")

  return { ok: true, error: null }
}

/** ナレッジ記事更新 Server Action。article_id/title/category/body_md 必須。作成者以外は api がエラーを返す。 */
export async function updateKnowledgeAction(
  previousState: KnowledgeActionState,
  formData: FormData,
): Promise<KnowledgeActionState> {
  await requireAuth()
  const commandId = toText(formData.get("command_id"))
  const reason = toText(formData.get("reason"))
  if (commandId === null || reason === null)
    return { ok: false, error: "記録理由を入力し、内容を確認して送信してください" }

  const articleId = toPositiveIntId(formData.get("article_id"))

  if (articleId === null) {
    return { ok: false, error: "記事を特定できませんでした" }
  }

  const title = toText(formData.get("title"))

  const category = toText(formData.get("category"))

  const bodyMd = toText(formData.get("body_md"))

  if (title === null || category === null || bodyMd === null) {
    return { ok: false, error: "タイトル・カテゴリ・本文を入力してください" }
  }

  const revision = toPositiveIntId(formData.get("revision"))
  if (revision === null)
    return { ok: false, error: "確認した版がありません。記事を開き直してください" }
  const updated = await updateKnowledge(
    articleId,
    {
      reason,
      title: title,
      category: category,
      tags: toText(formData.get("tags")),
      body_md: bodyMd,
    },
    { revision, commandId },
  )

  if (updated instanceof Error) {
    return { ok: false, error: updated.message }
  }

  revalidatePath("/knowledge/knowledge-articles")

  revalidatePath(`/knowledge/knowledge-articles/${articleId}`)

  return { ok: true, error: null }
}

/** ナレッジ記事取下げ Server Action。article_id 必須。作成者以外は api がエラーを返す。 */
export async function withdrawKnowledgeAction(
  previousState: KnowledgeActionState,
  formData: FormData,
): Promise<KnowledgeActionState> {
  await requireAuth()
  const commandId = toText(formData.get("command_id"))
  const reason = toText(formData.get("reason"))
  if (commandId === null || reason === null)
    return { ok: false, error: "記録理由を入力し、内容を確認して送信してください" }

  const articleId = toPositiveIntId(formData.get("article_id"))

  if (articleId === null) {
    return { ok: false, error: "記事を特定できませんでした" }
  }

  const revision = toPositiveIntId(formData.get("revision"))
  if (revision === null)
    return { ok: false, error: "確認した版がありません。記事を開き直してください" }
  const deleted = await withdrawKnowledge(articleId, { revision, commandId, reason })

  if (deleted instanceof Error) {
    return { ok: false, error: deleted.message }
  }

  revalidatePath("/knowledge/knowledge-articles")

  revalidatePath(`/knowledge/knowledge-articles/${articleId}`)

  return { ok: true, error: null }
}

/** FormData 値を文字列へ。未入力や空白のみは null。 */
function toText(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string" || value.trim() === "") {
    return null
  }

  return value.trim()
}
