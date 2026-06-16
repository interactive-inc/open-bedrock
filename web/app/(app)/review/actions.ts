"use server"

import { revalidatePath } from "next/cache"
import { closeReviewCycle } from "@/lib/api/close-review-cycle"
import { createReviewCycle } from "@/lib/api/create-review-cycle"
import { deleteReviewCycle } from "@/lib/api/delete-review-cycle"
import { getMe } from "@/lib/api/get-me"
import { openReviewCycle } from "@/lib/api/open-review-cycle"
import { submitReviewForm } from "@/lib/api/submit-review-form"
import { updateReviewCycle } from "@/lib/api/update-review-cycle"
import {
  FORM_CONSTRAINTS,
  toOptionalIntInRange,
  toOptionalIsoDate,
  toOptionalText,
  toRequiredText,
} from "@/lib/form/constraints"
import { toPositiveIntId } from "@/lib/form/to-positive-int-id"
import { canAdministerCycle } from "@/lib/review/can-administer-cycle"

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
  const currentUser = await getMe()

  if (currentUser instanceof Error || canAdministerCycle(currentUser.role) === false) {
    return { ok: false, error: "評価サイクルを管理する権限がありません" }
  }

  const title = toRequiredText(formData.get("title"), {
    label: "タイトル",
    max: FORM_CONSTRAINTS.review.titleMax,
  })

  if (title instanceof Error) {
    return { ok: false, error: title.message }
  }

  const period = toRequiredText(formData.get("period"), {
    label: "対象期間",
    max: FORM_CONSTRAINTS.review.periodMax,
  })

  if (period instanceof Error) {
    return { ok: false, error: period.message }
  }

  const dueDate = toOptionalIsoDate(formData.get("due_date"), "締切日")

  if (dueDate instanceof Error) {
    return { ok: false, error: dueDate.message }
  }

  const created = await createReviewCycle({ title: title, period: period, dueDate: dueDate })

  if (created instanceof Error) {
    return { ok: false, error: created.message }
  }

  revalidatePath("/review")
  revalidatePath("/review/manage")

  return { ok: true, error: null }
}

// 評価サイクル open Server Action。hidden input の cycle_id を受け取る。
export async function openReviewCycleAction(
  _previousState: ReviewFormState,
  formData: FormData,
): Promise<ReviewFormState> {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canAdministerCycle(currentUser.role) === false) {
    return { ok: false, error: "評価サイクルを管理する権限がありません" }
  }

  const cycleId = toPositiveIntId(formData.get("cycle_id"))

  if (cycleId === null) {
    return { ok: false, error: "サイクル ID が不正です" }
  }

  const opened = await openReviewCycle(cycleId)

  if (opened instanceof Error) {
    return { ok: false, error: opened.message }
  }

  revalidatePath("/review")
  revalidatePath("/review/manage")

  return { ok: true, error: null }
}

// 評価サイクル close Server Action。hidden input の cycle_id を受け取る。
export async function closeReviewCycleAction(
  _previousState: ReviewFormState,
  formData: FormData,
): Promise<ReviewFormState> {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canAdministerCycle(currentUser.role) === false) {
    return { ok: false, error: "評価サイクルを管理する権限がありません" }
  }

  const cycleId = toPositiveIntId(formData.get("cycle_id"))

  if (cycleId === null) {
    return { ok: false, error: "サイクル ID が不正です" }
  }

  const closed = await closeReviewCycle(cycleId)

  if (closed instanceof Error) {
    return { ok: false, error: closed.message }
  }

  revalidatePath("/review")
  revalidatePath("/review/manage")

  return { ok: true, error: null }
}

// 評価サイクル更新 Server Action（特権ロール）。cycle_id/title/period 必須、due_date 任意。
export async function updateReviewCycleAction(
  _previousState: ReviewFormState,
  formData: FormData,
): Promise<ReviewFormState> {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canAdministerCycle(currentUser.role) === false) {
    return { ok: false, error: "評価サイクルを管理する権限がありません" }
  }

  const cycleId = toPositiveIntId(formData.get("cycle_id"))

  if (cycleId === null) {
    return { ok: false, error: "サイクル ID が不正です" }
  }

  const title = toRequiredText(formData.get("title"), {
    label: "タイトル",
    max: FORM_CONSTRAINTS.review.titleMax,
  })

  if (title instanceof Error) {
    return { ok: false, error: title.message }
  }

  const period = toRequiredText(formData.get("period"), {
    label: "対象期間",
    max: FORM_CONSTRAINTS.review.periodMax,
  })

  if (period instanceof Error) {
    return { ok: false, error: period.message }
  }

  const dueDate = toOptionalIsoDate(formData.get("due_date"), "締切日")

  if (dueDate instanceof Error) {
    return { ok: false, error: dueDate.message }
  }

  const updated = await updateReviewCycle(cycleId, {
    title: title,
    period: period,
    dueDate: dueDate,
  })

  if (updated instanceof Error) {
    return { ok: false, error: updated.message }
  }

  revalidatePath("/review")
  revalidatePath("/review/manage")

  return { ok: true, error: null }
}

// 評価サイクル削除 Server Action（特権ロール）。hidden input の cycle_id を受け取る。
export async function deleteReviewCycleAction(
  _previousState: ReviewFormState,
  formData: FormData,
): Promise<ReviewFormState> {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canAdministerCycle(currentUser.role) === false) {
    return { ok: false, error: "評価サイクルを管理する権限がありません" }
  }

  const cycleId = toPositiveIntId(formData.get("cycle_id"))

  if (cycleId === null) {
    return { ok: false, error: "サイクル ID が不正です" }
  }

  const deleted = await deleteReviewCycle(cycleId)

  if (deleted instanceof Error) {
    return { ok: false, error: deleted.message }
  }

  revalidatePath("/review")
  revalidatePath("/review/manage")

  return { ok: true, error: null }
}

// 評価フォーム提出 Server Action。form_id 必須、score 任意、comment 任意。
export async function submitReviewFormAction(
  _previousState: ReviewFormState,
  formData: FormData,
): Promise<ReviewFormState> {
  const formId = toPositiveIntId(formData.get("form_id"))

  if (formId === null) {
    return { ok: false, error: "フォーム ID が不正です" }
  }

  const score = toOptionalIntInRange(formData.get("score"), {
    label: "スコア",
    min: FORM_CONSTRAINTS.review.scoreMin,
    max: FORM_CONSTRAINTS.review.scoreMax,
  })

  if (score instanceof Error) {
    return { ok: false, error: score.message }
  }

  const comment = toOptionalText(formData.get("comment"), {
    label: "コメント",
    max: FORM_CONSTRAINTS.review.commentMax,
  })

  if (comment instanceof Error) {
    return { ok: false, error: comment.message }
  }

  const submitted = await submitReviewForm({
    formId: formId,
    request: { score: score, answers: [], comment: comment },
  })

  if (submitted instanceof Error) {
    return { ok: false, error: submitted.message }
  }

  revalidatePath("/review")
  revalidatePath("/review/manage")

  return { ok: true, error: null }
}
