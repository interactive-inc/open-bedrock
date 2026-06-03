"use server"

import { revalidatePath } from "next/cache"
import { closeReviewCycle } from "@/lib/api/close-review-cycle"
import { createReviewCycle } from "@/lib/api/create-review-cycle"
import { deleteReviewCycle } from "@/lib/api/delete-review-cycle"
import { openReviewCycle } from "@/lib/api/open-review-cycle"
import { submitReviewForm } from "@/lib/api/submit-review-form"
import { updateReviewCycle } from "@/lib/api/update-review-cycle"

// useActionState で参照する共通の戻り値。ok=成功 / error=表示するエラー文言。
export type ReviewFormState = {
  ok: boolean
  error: string | null
}

// 評価サイクル作成 Server Action（特権ロール）。title/period 必須、due_date 任意。
export async function createReviewCycleAction(
  _previousState: ReviewFormState,
  formData: FormData,
): Promise<ReviewFormState> {
  const titleValue = formData.get("title")

  const title = typeof titleValue === "string" ? titleValue.trim() : ""

  if (title === "") {
    return { ok: false, error: "タイトルを入力してください" }
  }

  const periodValue = formData.get("period")

  const period = typeof periodValue === "string" ? periodValue.trim() : ""

  if (period === "") {
    return { ok: false, error: "対象期間を入力してください" }
  }

  const dueDateValue = formData.get("due_date")

  const dueDate =
    typeof dueDateValue === "string" && dueDateValue.trim() !== "" ? dueDateValue.trim() : null

  const created = await createReviewCycle({ title: title, period: period, dueDate: dueDate })

  if (created instanceof Error) {
    return { ok: false, error: "評価サイクルの作成に失敗しました" }
  }

  revalidatePath("/review")

  return { ok: true, error: null }
}

// 評価サイクル open Server Action。hidden input の cycle_id を受け取る。
export async function openReviewCycleAction(
  _previousState: ReviewFormState,
  formData: FormData,
): Promise<ReviewFormState> {
  const cycleId = Number(formData.get("cycle_id"))

  if (Number.isInteger(cycleId) === false) {
    return { ok: false, error: "サイクル ID が不正です" }
  }

  const opened = await openReviewCycle(cycleId)

  if (opened instanceof Error) {
    return { ok: false, error: "サイクルの開始に失敗しました" }
  }

  revalidatePath("/review")

  return { ok: true, error: null }
}

// 評価サイクル close Server Action。hidden input の cycle_id を受け取る。
export async function closeReviewCycleAction(
  _previousState: ReviewFormState,
  formData: FormData,
): Promise<ReviewFormState> {
  const cycleId = Number(formData.get("cycle_id"))

  if (Number.isInteger(cycleId) === false) {
    return { ok: false, error: "サイクル ID が不正です" }
  }

  const closed = await closeReviewCycle(cycleId)

  if (closed instanceof Error) {
    return { ok: false, error: "サイクルの終了に失敗しました" }
  }

  revalidatePath("/review")

  return { ok: true, error: null }
}

// 評価サイクル更新 Server Action（特権ロール）。cycle_id/title/period 必須、due_date 任意。
export async function updateReviewCycleAction(
  _previousState: ReviewFormState,
  formData: FormData,
): Promise<ReviewFormState> {
  const cycleId = Number(formData.get("cycle_id"))

  if (Number.isInteger(cycleId) === false) {
    return { ok: false, error: "サイクル ID が不正です" }
  }

  const titleValue = formData.get("title")

  const title = typeof titleValue === "string" ? titleValue.trim() : ""

  if (title === "") {
    return { ok: false, error: "タイトルを入力してください" }
  }

  const periodValue = formData.get("period")

  const period = typeof periodValue === "string" ? periodValue.trim() : ""

  if (period === "") {
    return { ok: false, error: "対象期間を入力してください" }
  }

  const dueDateValue = formData.get("due_date")

  const dueDate =
    typeof dueDateValue === "string" && dueDateValue.trim() !== "" ? dueDateValue.trim() : null

  const updated = await updateReviewCycle(cycleId, {
    title: title,
    period: period,
    dueDate: dueDate,
  })

  if (updated instanceof Error) {
    return { ok: false, error: "評価サイクルの更新に失敗しました" }
  }

  revalidatePath("/review")

  return { ok: true, error: null }
}

// 評価サイクル削除 Server Action（特権ロール）。hidden input の cycle_id を受け取る。
export async function deleteReviewCycleAction(
  _previousState: ReviewFormState,
  formData: FormData,
): Promise<ReviewFormState> {
  const cycleId = Number(formData.get("cycle_id"))

  if (Number.isInteger(cycleId) === false) {
    return { ok: false, error: "サイクル ID が不正です" }
  }

  const deleted = await deleteReviewCycle(cycleId)

  if (deleted instanceof Error) {
    return { ok: false, error: "評価サイクルの削除に失敗しました" }
  }

  revalidatePath("/review")

  return { ok: true, error: null }
}

// 評価フォーム提出 Server Action。form_id 必須、score 任意、comment 任意。
export async function submitReviewFormAction(
  _previousState: ReviewFormState,
  formData: FormData,
): Promise<ReviewFormState> {
  const formId = Number(formData.get("form_id"))

  if (Number.isInteger(formId) === false) {
    return { ok: false, error: "フォーム ID が不正です" }
  }

  const scoreValue = formData.get("score")

  const scoreText = typeof scoreValue === "string" ? scoreValue.trim() : ""

  const score = scoreText === "" ? null : Number(scoreText)

  if (score !== null && Number.isFinite(score) === false) {
    return { ok: false, error: "スコアは数値で入力してください" }
  }

  const commentValue = formData.get("comment")

  const comment =
    typeof commentValue === "string" && commentValue.trim() !== "" ? commentValue.trim() : null

  const submitted = await submitReviewForm({
    formId: formId,
    request: { score: score, answers: [], comment: comment },
  })

  if (submitted instanceof Error) {
    return { ok: false, error: "評価フォームの提出に失敗しました" }
  }

  revalidatePath("/review")

  return { ok: true, error: null }
}
