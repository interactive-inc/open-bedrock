"use server"

import { revalidatePath } from "next/cache"
import { applyCareerPosting } from "@/lib/api/apply-career-posting"
import { createCareerPosting } from "@/lib/api/create-career-posting"
import { deleteCareerPosting } from "@/lib/api/delete-career-posting"
import { getMe } from "@/lib/api/get-me"
import { updateCareerApplication } from "@/lib/api/update-career-application"
import { updateCareerPosting } from "@/lib/api/update-career-posting"
import { updateCareerSheet } from "@/lib/api/update-career-sheet"
import { withdrawCareerApplication } from "@/lib/api/withdraw-career-application"
import { canManageCareerPostings } from "@/lib/career/can-manage-career-postings"
import { toPositiveIntId } from "@/lib/form/to-positive-int-id"

export type CareerSheetFormState = {
  ok: boolean
  error: string | null
}

export type CareerApplyFormState = {
  ok: boolean
  error: string | null
}

export type CareerApplicationActionState = {
  ok: boolean
  error: string | null
}

// キャリアシート更新の Server Action。useActionState から呼ばれる。
// 空文字は値なし (null) として送る。
export async function updateCareerSheetAction(
  previousState: CareerSheetFormState,
  formData: FormData,
): Promise<CareerSheetFormState> {
  const goalsValue = formData.get("goals_text")

  const strengthsValue = formData.get("strengths_text")

  const goalsText = typeof goalsValue === "string" && goalsValue !== "" ? goalsValue : null

  const strengthsText =
    typeof strengthsValue === "string" && strengthsValue !== "" ? strengthsValue : null

  const updated = await updateCareerSheet({
    goals_text: goalsText,
    strengths_text: strengthsText,
  })

  if (updated instanceof Error) {
    return { ok: false, error: updated.message }
  }

  revalidatePath("/career")

  return { ok: true, error: null }
}

// 社内公募への応募 Server Action。postingId は hidden フィールドから受け取る。
export async function applyCareerPostingAction(
  previousState: CareerApplyFormState,
  formData: FormData,
): Promise<CareerApplyFormState> {
  const postingId = toPositiveIntId(formData.get("posting_id"))

  if (postingId === null) {
    return { ok: false, error: "公募が不正です" }
  }

  const messageValue = formData.get("message")

  const message = typeof messageValue === "string" && messageValue !== "" ? messageValue : null

  const created = await applyCareerPosting(postingId, { message })

  if (created instanceof Error) {
    return { ok: false, error: created.message }
  }

  revalidatePath("/career")
  revalidatePath("/career/postings")
  revalidatePath("/career/postings/[id]", "page")

  return { ok: true, error: null }
}

// 応募メッセージ変更の Server Action。application_id 必須、空文字は値なし (null)。
// 選考確定済みは api が 409 を返し Error になる。
export async function updateCareerApplicationAction(
  previousState: CareerApplicationActionState,
  formData: FormData,
): Promise<CareerApplicationActionState> {
  const applicationId = toPositiveIntId(formData.get("application_id"))

  if (applicationId === null) {
    return { ok: false, error: "応募を特定できませんでした" }
  }

  const messageValue = formData.get("message")

  const message = typeof messageValue === "string" && messageValue !== "" ? messageValue : null

  const updated = await updateCareerApplication(applicationId, { message })

  if (updated instanceof Error) {
    return { ok: false, error: updated.message }
  }

  revalidatePath("/career")

  return { ok: true, error: null }
}

// 応募取り下げの Server Action。application_id 必須。
// 選考確定済みは api が 409 を返し Error になる。
export async function withdrawCareerApplicationAction(
  previousState: CareerApplicationActionState,
  formData: FormData,
): Promise<CareerApplicationActionState> {
  const applicationId = toPositiveIntId(formData.get("application_id"))

  if (applicationId === null) {
    return { ok: false, error: "応募を特定できませんでした" }
  }

  const withdrawn = await withdrawCareerApplication(applicationId)

  if (withdrawn instanceof Error) {
    return { ok: false, error: withdrawn.message }
  }

  revalidatePath("/career")

  return { ok: true, error: null }
}

// 管理ロール向け公募操作の共通の戻り値。ok=成功 / error=表示するエラー文言。
export type CareerPostingFormState = {
  ok: boolean
  error: string | null
}

// 公募作成の Server Action（管理ロール）。title 必須、部署・必要スキルは任意。
export async function createCareerPostingAction(
  previousState: CareerPostingFormState,
  formData: FormData,
): Promise<CareerPostingFormState> {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canManageCareerPostings(currentUser.role) === false) {
    return { ok: false, error: "公募を管理する権限がありません" }
  }

  const title = toText(formData.get("title"))

  if (title === null) {
    return { ok: false, error: "公募名を入力してください" }
  }

  const deptId = toOptionalId(formData.get("dept_id"))

  if (deptId === "invalid") {
    return { ok: false, error: "部署IDは整数で入力してください" }
  }

  const created = await createCareerPosting({
    title: title,
    dept_id: deptId,
    dept_name: toText(formData.get("dept_name")),
    required_skills: toText(formData.get("required_skills")),
    status: toPostingStatus(formData.get("status")),
  })

  if (created instanceof Error) {
    return { ok: false, error: created.message }
  }

  revalidatePath("/career/postings")
  revalidatePath("/career/postings/[id]", "page")

  return { ok: true, error: null }
}

// 公募変更の Server Action（管理ロール）。posting_id は hidden、内容は各 input で受け取る。
export async function updateCareerPostingAction(
  previousState: CareerPostingFormState,
  formData: FormData,
): Promise<CareerPostingFormState> {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canManageCareerPostings(currentUser.role) === false) {
    return { ok: false, error: "公募を管理する権限がありません" }
  }

  const postingId = toPositiveIntId(formData.get("posting_id"))

  if (postingId === null) {
    return { ok: false, error: "公募を特定できませんでした" }
  }

  const title = toText(formData.get("title"))

  if (title === null) {
    return { ok: false, error: "公募名を入力してください" }
  }

  const deptId = toOptionalId(formData.get("dept_id"))

  if (deptId === "invalid") {
    return { ok: false, error: "部署IDは整数で入力してください" }
  }

  const updated = await updateCareerPosting(postingId, {
    title: title,
    dept_id: deptId,
    dept_name: toText(formData.get("dept_name")),
    required_skills: toText(formData.get("required_skills")),
    status: toPostingStatus(formData.get("status")),
  })

  if (updated instanceof Error) {
    return { ok: false, error: updated.message }
  }

  revalidatePath("/career/postings")
  revalidatePath("/career/postings/[id]", "page")

  return { ok: true, error: null }
}

// 公募削除の Server Action（管理ロール）。posting_id を hidden で受け取る。
export async function deleteCareerPostingAction(
  previousState: CareerPostingFormState,
  formData: FormData,
): Promise<CareerPostingFormState> {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canManageCareerPostings(currentUser.role) === false) {
    return { ok: false, error: "公募を管理する権限がありません" }
  }

  const postingId = toPositiveIntId(formData.get("posting_id"))

  if (postingId === null) {
    return { ok: false, error: "公募を特定できませんでした" }
  }

  const deleted = await deleteCareerPosting(postingId)

  if (deleted instanceof Error) {
    return { ok: false, error: deleted.message }
  }

  revalidatePath("/career/postings")
  revalidatePath("/career/postings/[id]", "page")

  return { ok: true, error: null }
}

// 文字列フィールドを取り出す。空文字や非文字列は null。
function toText(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim()

  return trimmed === "" ? null : trimmed
}

// 任意の整数 ID フィールド。未入力は null、整数でなければ "invalid"。
function toOptionalId(value: FormDataEntryValue | null): number | null | "invalid" {
  const text = toText(value)

  if (text === null) {
    return null
  }

  const parsed = Number(text)

  return Number.isInteger(parsed) ? parsed : "invalid"
}

// status フィールドを open/closed に正規化する。closed 以外は open。
function toPostingStatus(value: FormDataEntryValue | null): "open" | "closed" {
  return value === "closed" ? "closed" : "open"
}
