"use server"

import { revalidatePath } from "next/cache"
import { createKnowledge } from "@/lib/api/create-knowledge"
import { deleteKnowledge } from "@/lib/api/delete-knowledge"
import { updateKnowledge } from "@/lib/api/update-knowledge"
import { toPositiveIntId } from "@/lib/form/to-positive-int-id"
import { requireAuth } from "@/lib/auth/require-auth"

// useActionState で参照する共通の戻り値。ok=成功 / error=表示するエラー文言。
export type KnowledgeActionState = {
  ok: boolean
  error: string | null
}

// ナレッジ記事作成 Server Action。title/category/body_md 必須、tags は任意。
// 成功時は /knowledge を revalidate する。
export async function createKnowledgeAction(
  previousState: KnowledgeActionState,
  formData: FormData,
): Promise<KnowledgeActionState> {
  await requireAuth()

  const title = toText(formData.get("title"))

  const category = toText(formData.get("category"))

  const bodyMd = toText(formData.get("body_md"))

  if (title === null || category === null || bodyMd === null) {
    return { ok: false, error: "タイトル・カテゴリ・本文を入力してください" }
  }

  const created = await createKnowledge({
    title: title,
    category: category,
    tags: toText(formData.get("tags")),
    body_md: bodyMd,
  })

  if (created instanceof Error) {
    return { ok: false, error: created.message }
  }

  revalidatePath("/organization/knowledge-articles")

  return { ok: true, error: null }
}

// ナレッジ記事更新 Server Action。article_id/title/category/body_md 必須。作成者以外は api がエラーを返す。
export async function updateKnowledgeAction(
  previousState: KnowledgeActionState,
  formData: FormData,
): Promise<KnowledgeActionState> {
  await requireAuth()

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

  const updated = await updateKnowledge(articleId, {
    title: title,
    category: category,
    tags: toText(formData.get("tags")),
    body_md: bodyMd,
  })

  if (updated instanceof Error) {
    return { ok: false, error: "記事の変更に失敗しました（作成者のみ変更できます）" }
  }

  revalidatePath("/organization/knowledge-articles")

  revalidatePath(`/organization/knowledge-articles/${articleId}`)

  return { ok: true, error: null }
}

// ナレッジ記事削除 Server Action。article_id 必須。作成者以外は api がエラーを返す。
export async function deleteKnowledgeAction(
  previousState: KnowledgeActionState,
  formData: FormData,
): Promise<KnowledgeActionState> {
  await requireAuth()

  const articleId = toPositiveIntId(formData.get("article_id"))

  if (articleId === null) {
    return { ok: false, error: "記事を特定できませんでした" }
  }

  const deleted = await deleteKnowledge(articleId)

  if (deleted instanceof Error) {
    return { ok: false, error: "記事の削除に失敗しました（作成者のみ削除できます）" }
  }

  revalidatePath("/organization/knowledge-articles")

  revalidatePath(`/organization/knowledge-articles/${articleId}`)

  return { ok: true, error: null }
}

// FormData 値を文字列へ。未入力や空白のみは null。
function toText(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string" || value.trim() === "") {
    return null
  }

  return value.trim()
}
