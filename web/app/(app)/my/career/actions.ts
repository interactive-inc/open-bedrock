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
import { requireAuth } from "@/lib/auth/require-auth"
import { canManageCareerPostings } from "@/lib/career/can-manage-career-postings"
import { FORM_CONSTRAINTS } from "@/lib/form/constraints"
import { toOptionalText } from "@/lib/form/to-optional-text"
import { toRequiredText } from "@/lib/form/to-required-text"
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

/**
 * キャリアシート更新の Server Action。useActionState から呼ばれる。
 * 空文字は値なし (null) として送る。
 */
export async function updateCareerSheetAction(
  previousState: CareerSheetFormState,
  formData: FormData,
): Promise<CareerSheetFormState> {
  await requireAuth()

  const goalsText = toOptionalText(formData.get("goals_text"), {
    label: "キャリア目標",
    max: FORM_CONSTRAINTS.career.sheetTextMax,
  })

  if (goalsText instanceof Error) {
    return { ok: false, error: goalsText.message }
  }

  const strengthsText = toOptionalText(formData.get("strengths_text"), {
    label: "強み・得意領域",
    max: FORM_CONSTRAINTS.career.sheetTextMax,
  })

  if (strengthsText instanceof Error) {
    return { ok: false, error: strengthsText.message }
  }

  const updated = await updateCareerSheet({
    goals_text: goalsText,
    strengths_text: strengthsText,
  })

  if (updated instanceof Error) {
    return { ok: false, error: updated.message }
  }

  revalidatePath("/my/career")

  return { ok: true, error: null }
}

/** 社内公募への応募 Server Action。postingId は hidden フィールドから受け取る。 */
export async function applyCareerPostingAction(
  previousState: CareerApplyFormState,
  formData: FormData,
): Promise<CareerApplyFormState> {
  await requireAuth()

  const postingId = toPositiveIntId(formData.get("posting_id"))

  if (postingId === null) {
    return { ok: false, error: "公募が不正です" }
  }

  const message = toOptionalText(formData.get("message"), {
    label: "応募メッセージ",
    max: FORM_CONSTRAINTS.career.applicationMessageMax,
  })

  if (message instanceof Error) {
    return { ok: false, error: message.message }
  }

  const created = await applyCareerPosting(postingId, { message })

  if (created instanceof Error) {
    return { ok: false, error: created.message }
  }

  revalidatePath("/my/career")
  revalidatePath("/career/job-postings")
  revalidatePath("/career/job-postings/[posting]", "page")

  return { ok: true, error: null }
}

/**
 * 応募メッセージ変更の Server Action。application_id 必須、空文字は値なし (null)。
 * 選考確定済みは api が 409 を返し Error になる。
 */
export async function updateCareerApplicationAction(
  previousState: CareerApplicationActionState,
  formData: FormData,
): Promise<CareerApplicationActionState> {
  await requireAuth()

  const applicationId = toPositiveIntId(formData.get("application_id"))

  if (applicationId === null) {
    return { ok: false, error: "応募を特定できませんでした" }
  }

  const message = toOptionalText(formData.get("message"), {
    label: "応募メッセージ",
    max: FORM_CONSTRAINTS.career.applicationMessageMax,
  })

  if (message instanceof Error) {
    return { ok: false, error: message.message }
  }

  const updated = await updateCareerApplication(applicationId, { message })

  if (updated instanceof Error) {
    return { ok: false, error: updated.message }
  }

  revalidatePath("/my/career")

  return { ok: true, error: null }
}

/**
 * 応募取り下げの Server Action。application_id 必須。
 * 選考確定済みは api が 409 を返し Error になる。
 */
export async function withdrawCareerApplicationAction(
  previousState: CareerApplicationActionState,
  formData: FormData,
): Promise<CareerApplicationActionState> {
  await requireAuth()

  const applicationId = toPositiveIntId(formData.get("application_id"))

  if (applicationId === null) {
    return { ok: false, error: "応募を特定できませんでした" }
  }

  const withdrawn = await withdrawCareerApplication(applicationId)

  if (withdrawn instanceof Error) {
    return { ok: false, error: withdrawn.message }
  }

  revalidatePath("/my/career")

  return { ok: true, error: null }
}

/** 管理ロール向け公募操作の共通の戻り値。ok=成功 / error=表示するエラー文言。 */
export type CareerPostingFormState = {
  ok: boolean
  error: string | null
}

/** 公募作成の Server Action（管理ロール）。title 必須、部署・必要スキルは任意。 */
export async function createCareerPostingAction(
  previousState: CareerPostingFormState,
  formData: FormData,
): Promise<CareerPostingFormState> {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canManageCareerPostings(currentUser.permissions) === false) {
    return { ok: false, error: "公募を管理する権限がありません" }
  }

  const title = toRequiredText(formData.get("title"), {
    label: "公募名",
    max: FORM_CONSTRAINTS.career.postingTitleMax,
  })

  if (title instanceof Error) {
    return { ok: false, error: title.message }
  }

  const deptId = toOptionalId(formData.get("dept_id"))

  if (deptId === "invalid") {
    return { ok: false, error: "部署IDは整数で入力してください" }
  }

  const deptName = toOptionalText(formData.get("dept_name"), {
    label: "部署名",
    max: FORM_CONSTRAINTS.career.deptNameMax,
  })

  if (deptName instanceof Error) {
    return { ok: false, error: deptName.message }
  }

  const requiredSkills = toOptionalText(formData.get("required_skills"), {
    label: "必要スキル",
    max: FORM_CONSTRAINTS.career.requiredSkillsMax,
  })

  if (requiredSkills instanceof Error) {
    return { ok: false, error: requiredSkills.message }
  }

  const created = await createCareerPosting({
    title: title,
    dept_id: deptId,
    dept_name: deptName,
    required_skills: requiredSkills,
    status: toPostingStatus(formData.get("status")),
  })

  if (created instanceof Error) {
    return { ok: false, error: created.message }
  }

  revalidatePath("/career/job-postings")
  revalidatePath("/career/job-postings/[posting]", "page")

  return { ok: true, error: null }
}

/** 公募変更の Server Action（管理ロール）。posting_id は hidden、内容は各 input で受け取る。 */
export async function updateCareerPostingAction(
  previousState: CareerPostingFormState,
  formData: FormData,
): Promise<CareerPostingFormState> {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canManageCareerPostings(currentUser.permissions) === false) {
    return { ok: false, error: "公募を管理する権限がありません" }
  }

  const postingId = toPositiveIntId(formData.get("posting_id"))

  if (postingId === null) {
    return { ok: false, error: "公募を特定できませんでした" }
  }

  const title = toRequiredText(formData.get("title"), {
    label: "公募名",
    max: FORM_CONSTRAINTS.career.postingTitleMax,
  })

  if (title instanceof Error) {
    return { ok: false, error: title.message }
  }

  const deptId = toOptionalId(formData.get("dept_id"))

  if (deptId === "invalid") {
    return { ok: false, error: "部署IDは整数で入力してください" }
  }

  const deptName = toOptionalText(formData.get("dept_name"), {
    label: "部署名",
    max: FORM_CONSTRAINTS.career.deptNameMax,
  })

  if (deptName instanceof Error) {
    return { ok: false, error: deptName.message }
  }

  const requiredSkills = toOptionalText(formData.get("required_skills"), {
    label: "必要スキル",
    max: FORM_CONSTRAINTS.career.requiredSkillsMax,
  })

  if (requiredSkills instanceof Error) {
    return { ok: false, error: requiredSkills.message }
  }

  const updated = await updateCareerPosting(postingId, {
    title: title,
    dept_id: deptId,
    dept_name: deptName,
    required_skills: requiredSkills,
    status: toPostingStatus(formData.get("status")),
  })

  if (updated instanceof Error) {
    return { ok: false, error: updated.message }
  }

  revalidatePath("/career/job-postings")
  revalidatePath("/career/job-postings/[posting]", "page")

  return { ok: true, error: null }
}

/** 公募削除の Server Action（管理ロール）。posting_id を hidden で受け取る。 */
export async function deleteCareerPostingAction(
  previousState: CareerPostingFormState,
  formData: FormData,
): Promise<CareerPostingFormState> {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canManageCareerPostings(currentUser.permissions) === false) {
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

  revalidatePath("/career/job-postings")
  revalidatePath("/career/job-postings/[posting]", "page")

  return { ok: true, error: null }
}

/** 文字列フィールドを取り出す。空文字や非文字列は null。 */
function toText(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim()

  return trimmed === "" ? null : trimmed
}

/** 任意の整数 ID フィールド。未入力は null、整数でなければ "invalid"。 */
function toOptionalId(value: FormDataEntryValue | null): number | null | "invalid" {
  const text = toText(value)

  if (text === null) {
    return null
  }

  const parsed = Number(text)

  return Number.isInteger(parsed) ? parsed : "invalid"
}

/** status フィールドを open/closed に正規化する。closed 以外は open。 */
function toPostingStatus(value: FormDataEntryValue | null): "open" | "closed" {
  return value === "closed" ? "closed" : "open"
}
