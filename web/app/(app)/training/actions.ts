"use server"

import { revalidatePath } from "next/cache"
import { archiveTrainingCourse } from "@/lib/api/archive-training-course"
import { cancelTrainingEnrollment } from "@/lib/api/cancel-training-enrollment"
import { completeTrainingEnrollment } from "@/lib/api/complete-training-enrollment"
import { createTrainingCourse } from "@/lib/api/create-training-course"
import { createTrainingEnrollment } from "@/lib/api/create-training-enrollment"
import { updateTrainingCourse } from "@/lib/api/update-training-course"
import { toPositiveIntId } from "@/lib/form/to-positive-int-id"

// useActionState で参照する共通の戻り値。ok=成功 / error=表示するエラー文言。
export type TrainingFormState = {
  ok: boolean
  error: string | null
}

// 受講申込 Server Action（本人）。course_code を hidden input で受け取る。
export async function createTrainingEnrollmentAction(
  _previousState: TrainingFormState,
  formData: FormData,
): Promise<TrainingFormState> {
  const courseCodeValue = formData.get("course_code")

  const courseCode = typeof courseCodeValue === "string" ? courseCodeValue.trim() : ""

  if (courseCode === "") {
    return { ok: false, error: "コードが不明です" }
  }

  const created = await createTrainingEnrollment({ course_code: courseCode })

  if (created instanceof Error) {
    return { ok: false, error: "受講の申込に失敗しました" }
  }

  revalidatePath("/training")

  return { ok: true, error: null }
}

// 受講完了 Server Action（本人）。enrollment_id を hidden input で受け取る。
export async function completeTrainingEnrollmentAction(
  _previousState: TrainingFormState,
  formData: FormData,
): Promise<TrainingFormState> {
  const enrollmentIdValue = formData.get("enrollment_id")

  const enrollmentIdText = typeof enrollmentIdValue === "string" ? enrollmentIdValue.trim() : ""

  if (enrollmentIdText === "") {
    return { ok: false, error: "受講が不明です" }
  }

  const enrollmentId = toPositiveIntId(enrollmentIdText)

  if (enrollmentId === null) {
    return { ok: false, error: "受講IDが不正です" }
  }

  const completed = await completeTrainingEnrollment(enrollmentId)

  if (completed instanceof Error) {
    return { ok: false, error: "受講の完了に失敗しました" }
  }

  revalidatePath("/training")

  return { ok: true, error: null }
}

// コース作成 Server Action（特権ロール）。code/title/category 必須、description/duration_minutes 任意。
export async function createTrainingCourseAction(
  _previousState: TrainingFormState,
  formData: FormData,
): Promise<TrainingFormState> {
  const codeValue = formData.get("code")

  const code = typeof codeValue === "string" ? codeValue.trim() : ""

  if (code === "") {
    return { ok: false, error: "コースのコードを入力してください" }
  }

  const titleValue = formData.get("title")

  const title = typeof titleValue === "string" ? titleValue.trim() : ""

  if (title === "") {
    return { ok: false, error: "コース名を入力してください" }
  }

  const categoryValue = formData.get("category")

  const category = typeof categoryValue === "string" ? categoryValue.trim() : ""

  if (category === "") {
    return { ok: false, error: "カテゴリを入力してください" }
  }

  const descriptionValue = formData.get("description")

  const description =
    typeof descriptionValue === "string" && descriptionValue.trim() !== ""
      ? descriptionValue.trim()
      : null

  const durationValue = formData.get("duration_minutes")

  const durationText = typeof durationValue === "string" ? durationValue.trim() : ""

  const durationMinutes = durationText === "" ? null : Number(durationText)

  if (durationMinutes !== null && !(Number.isInteger(durationMinutes) && durationMinutes > 0)) {
    return { ok: false, error: "所要時間は正の整数（分）で入力してください" }
  }

  const isRequired = formData.get("is_required") === "on"

  const created = await createTrainingCourse({
    code: code,
    title: title,
    category: category,
    description: description,
    duration_minutes: durationMinutes,
    is_required: isRequired,
  })

  if (created instanceof Error) {
    return { ok: false, error: "コースの作成に失敗しました" }
  }

  revalidatePath("/training")

  return { ok: true, error: null }
}

// 受講取消 Server Action（本人または管理権限）。enrollment_id を hidden input で受け取る。
export async function cancelTrainingEnrollmentAction(
  _previousState: TrainingFormState,
  formData: FormData,
): Promise<TrainingFormState> {
  const enrollmentIdValue = formData.get("enrollment_id")

  const enrollmentIdText = typeof enrollmentIdValue === "string" ? enrollmentIdValue.trim() : ""

  if (enrollmentIdText === "") {
    return { ok: false, error: "受講が不明です" }
  }

  const enrollmentId = toPositiveIntId(enrollmentIdText)

  if (enrollmentId === null) {
    return { ok: false, error: "受講IDが不正です" }
  }

  const cancelled = await cancelTrainingEnrollment(enrollmentId)

  if (cancelled instanceof Error) {
    return { ok: false, error: "受講の取り消しに失敗しました" }
  }

  revalidatePath("/training")

  return { ok: true, error: null }
}

// コース変更 Server Action（管理権限）。code は hidden input、内容は各 input で受け取る。
export async function updateTrainingCourseAction(
  _previousState: TrainingFormState,
  formData: FormData,
): Promise<TrainingFormState> {
  const codeValue = formData.get("code")

  const code = typeof codeValue === "string" ? codeValue.trim() : ""

  if (code === "") {
    return { ok: false, error: "コースが不明です" }
  }

  const titleValue = formData.get("title")

  const title = typeof titleValue === "string" ? titleValue.trim() : ""

  if (title === "") {
    return { ok: false, error: "コース名を入力してください" }
  }

  const categoryValue = formData.get("category")

  const category = typeof categoryValue === "string" ? categoryValue.trim() : ""

  if (category === "") {
    return { ok: false, error: "カテゴリを入力してください" }
  }

  const descriptionValue = formData.get("description")

  const description =
    typeof descriptionValue === "string" && descriptionValue.trim() !== ""
      ? descriptionValue.trim()
      : null

  const durationValue = formData.get("duration_minutes")

  const durationText = typeof durationValue === "string" ? durationValue.trim() : ""

  const durationMinutes = durationText === "" ? null : Number(durationText)

  if (durationMinutes !== null && !(Number.isInteger(durationMinutes) && durationMinutes > 0)) {
    return { ok: false, error: "所要時間は正の整数（分）で入力してください" }
  }

  const isRequired = formData.get("is_required") === "on"

  const updated = await updateTrainingCourse(code, {
    title: title,
    category: category,
    description: description,
    duration_minutes: durationMinutes,
    is_required: isRequired,
  })

  if (updated instanceof Error) {
    return { ok: false, error: "コースの変更に失敗しました" }
  }

  revalidatePath("/training")

  return { ok: true, error: null }
}

// コースアーカイブ Server Action（管理権限）。code を hidden input で受け取る。
export async function archiveTrainingCourseAction(
  _previousState: TrainingFormState,
  formData: FormData,
): Promise<TrainingFormState> {
  const codeValue = formData.get("code")

  const code = typeof codeValue === "string" ? codeValue.trim() : ""

  if (code === "") {
    return { ok: false, error: "コースが不明です" }
  }

  const archived = await archiveTrainingCourse(code)

  if (archived instanceof Error) {
    return { ok: false, error: "コースのアーカイブに失敗しました" }
  }

  revalidatePath("/training")

  return { ok: true, error: null }
}
