"use server"

import { revalidatePath } from "next/cache"
import { cancelShiftSwapRequest } from "@/lib/api/cancel-shift-swap-request"
import { createShiftAssignment } from "@/lib/api/create-shift-assignment"
import { createShiftPattern } from "@/lib/api/create-shift-pattern"
import { createShiftSwapRequest } from "@/lib/api/create-shift-swap-request"
import { deleteShiftAssignment } from "@/lib/api/delete-shift-assignment"
import { deleteShiftPattern } from "@/lib/api/delete-shift-pattern"
import { getMe } from "@/lib/api/get-me"
import { publishShiftAssignment } from "@/lib/api/publish-shift-assignment"
import { updateShiftAssignment } from "@/lib/api/update-shift-assignment"
import { updateShiftPattern } from "@/lib/api/update-shift-pattern"
import { toPositiveIntId } from "@/lib/form/to-positive-int-id"
import { canManageShift } from "@/lib/shift/can-manage-shift"

// useActionState で参照する共通の戻り値。ok=成功 / error=表示するエラー文言。
export type ShiftFormState = {
  ok: boolean
  error: string | null
}

// シフト交代申請 Server Action（本人）。target_employee_code/date 必須、note 任意。
export async function createShiftSwapRequestAction(
  _previousState: ShiftFormState,
  formData: FormData,
): Promise<ShiftFormState> {
  const targetCodeValue = formData.get("target_employee_code")

  const targetEmployeeCode = typeof targetCodeValue === "string" ? targetCodeValue.trim() : ""

  if (targetEmployeeCode === "") {
    return { ok: false, error: "交代相手の社員コードを入力してください" }
  }

  const dateValue = formData.get("date")

  const date = typeof dateValue === "string" ? dateValue.trim() : ""

  if (date === "") {
    return { ok: false, error: "対象日を入力してください" }
  }

  const noteValue = formData.get("note")

  const note = typeof noteValue === "string" && noteValue.trim() !== "" ? noteValue.trim() : null

  const created = await createShiftSwapRequest({
    target_employee_code: targetEmployeeCode,
    date: date,
    note: note,
  })

  if (created instanceof Error) {
    return { ok: false, error: created.message }
  }

  revalidatePath("/shift")

  return { ok: true, error: null }
}

// シフト割当作成 Server Action（特権ロール）。employee_code/pattern_code/date 必須、note 任意。
export async function createShiftAssignmentAction(
  _previousState: ShiftFormState,
  formData: FormData,
): Promise<ShiftFormState> {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canManageShift(currentUser.role) === false) {
    return { ok: false, error: "シフトを管理する権限がありません" }
  }

  const employeeCodeValue = formData.get("employee_code")

  const employeeCode = typeof employeeCodeValue === "string" ? employeeCodeValue.trim() : ""

  if (employeeCode === "") {
    return { ok: false, error: "社員コードを入力してください" }
  }

  const patternCodeValue = formData.get("pattern_code")

  const patternCode = typeof patternCodeValue === "string" ? patternCodeValue.trim() : ""

  if (patternCode === "") {
    return { ok: false, error: "シフトパターンのコードを入力してください" }
  }

  const dateValue = formData.get("date")

  const date = typeof dateValue === "string" ? dateValue.trim() : ""

  if (date === "") {
    return { ok: false, error: "対象日を入力してください" }
  }

  const noteValue = formData.get("note")

  const note =
    typeof noteValue === "string" && noteValue.trim() !== "" ? noteValue.trim() : undefined

  const created = await createShiftAssignment({
    employee_code: employeeCode,
    pattern_code: patternCode,
    date: date,
    note: note,
  })

  if (created instanceof Error) {
    return { ok: false, error: created.message }
  }

  revalidatePath("/shift")

  return { ok: true, error: null }
}

// シフト割当公開 Server Action（特権ロール）。hidden input の assignment_id を受け取る。
export async function publishShiftAssignmentAction(
  _previousState: ShiftFormState,
  formData: FormData,
): Promise<ShiftFormState> {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canManageShift(currentUser.role) === false) {
    return { ok: false, error: "シフトを管理する権限がありません" }
  }

  const assignmentId = toPositiveIntId(formData.get("assignment_id"))

  if (assignmentId === null) {
    return { ok: false, error: "割当 ID が不正です" }
  }

  const published = await publishShiftAssignment(assignmentId)

  if (published instanceof Error) {
    return { ok: false, error: published.message }
  }

  revalidatePath("/shift")

  return { ok: true, error: null }
}

// シフトパターン作成 Server Action（特権ロール）。code/name/start_time/end_time 必須、break_minutes 任意。
export async function createShiftPatternAction(
  _previousState: ShiftFormState,
  formData: FormData,
): Promise<ShiftFormState> {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canManageShift(currentUser.role) === false) {
    return { ok: false, error: "シフトを管理する権限がありません" }
  }

  const codeValue = formData.get("code")

  const code = typeof codeValue === "string" ? codeValue.trim() : ""

  if (code === "") {
    return { ok: false, error: "パターンのコードを入力してください" }
  }

  const nameValue = formData.get("name")

  const name = typeof nameValue === "string" ? nameValue.trim() : ""

  if (name === "") {
    return { ok: false, error: "パターン名を入力してください" }
  }

  const startTimeValue = formData.get("start_time")

  const startTime = typeof startTimeValue === "string" ? startTimeValue.trim() : ""

  if (startTime === "") {
    return { ok: false, error: "開始時刻を入力してください" }
  }

  const endTimeValue = formData.get("end_time")

  const endTime = typeof endTimeValue === "string" ? endTimeValue.trim() : ""

  if (endTime === "") {
    return { ok: false, error: "終了時刻を入力してください" }
  }

  const breakMinutesValue = formData.get("break_minutes")

  const breakMinutesText = typeof breakMinutesValue === "string" ? breakMinutesValue.trim() : ""

  const breakMinutes = breakMinutesText === "" ? null : Number(breakMinutesText)

  if (breakMinutes !== null && (Number.isInteger(breakMinutes) === false || breakMinutes < 0)) {
    return { ok: false, error: "休憩時間は整数で入力してください" }
  }

  const created = await createShiftPattern({
    code: code,
    name: name,
    start_time: startTime,
    end_time: endTime,
    break_minutes: breakMinutes,
  })

  if (created instanceof Error) {
    return { ok: false, error: created.message }
  }

  revalidatePath("/shift")

  return { ok: true, error: null }
}

// シフト割当変更 Server Action（特権ロール）。assignment_id/date 必須、pattern_code/note 任意。
export async function updateShiftAssignmentAction(
  _previousState: ShiftFormState,
  formData: FormData,
): Promise<ShiftFormState> {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canManageShift(currentUser.role) === false) {
    return { ok: false, error: "シフトを管理する権限がありません" }
  }

  const assignmentId = toPositiveIntId(formData.get("assignment_id"))

  if (assignmentId === null) {
    return { ok: false, error: "割当 ID が不正です" }
  }

  const date = trimmedOrEmpty(formData.get("date"))

  if (date === "") {
    return { ok: false, error: "対象日を入力してください" }
  }

  const updated = await updateShiftAssignment(assignmentId, {
    pattern_code: trimmedOrNull(formData.get("pattern_code")),
    date: date,
    note: trimmedOrNull(formData.get("note")),
  })

  if (updated instanceof Error) {
    return { ok: false, error: updated.message }
  }

  revalidatePath("/shift")

  return { ok: true, error: null }
}

// シフト割当削除 Server Action（特権ロール）。assignment_id 必須。
export async function deleteShiftAssignmentAction(
  _previousState: ShiftFormState,
  formData: FormData,
): Promise<ShiftFormState> {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canManageShift(currentUser.role) === false) {
    return { ok: false, error: "シフトを管理する権限がありません" }
  }

  const assignmentId = toPositiveIntId(formData.get("assignment_id"))

  if (assignmentId === null) {
    return { ok: false, error: "割当 ID が不正です" }
  }

  const deleted = await deleteShiftAssignment(assignmentId)

  if (deleted instanceof Error) {
    return { ok: false, error: deleted.message }
  }

  revalidatePath("/shift")

  return { ok: true, error: null }
}

// シフトパターン変更 Server Action（特権ロール）。code/name/start_time/end_time 必須。
export async function updateShiftPatternAction(
  _previousState: ShiftFormState,
  formData: FormData,
): Promise<ShiftFormState> {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canManageShift(currentUser.role) === false) {
    return { ok: false, error: "シフトを管理する権限がありません" }
  }

  const patternId = toPositiveIntId(formData.get("pattern_id"))

  if (patternId === null) {
    return { ok: false, error: "パターン ID が不正です" }
  }

  const fields = toPatternFields(formData)

  if (fields instanceof Error) {
    return { ok: false, error: fields.message }
  }

  const updated = await updateShiftPattern(patternId, fields)

  if (updated instanceof Error) {
    return { ok: false, error: updated.message }
  }

  revalidatePath("/shift")

  return { ok: true, error: null }
}

// シフトパターン削除 Server Action（特権ロール）。pattern_id 必須。割当から参照中だと api が 409。
export async function deleteShiftPatternAction(
  _previousState: ShiftFormState,
  formData: FormData,
): Promise<ShiftFormState> {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canManageShift(currentUser.role) === false) {
    return { ok: false, error: "シフトを管理する権限がありません" }
  }

  const patternId = toPositiveIntId(formData.get("pattern_id"))

  if (patternId === null) {
    return { ok: false, error: "パターン ID が不正です" }
  }

  const deleted = await deleteShiftPattern(patternId)

  if (deleted instanceof Error) {
    return { ok: false, error: deleted.message }
  }

  revalidatePath("/shift")

  return { ok: true, error: null }
}

// シフト交代申請取り下げ Server Action（申請者本人）。swap_request_id 必須。承認済みは api が 409。
export async function cancelShiftSwapRequestAction(
  _previousState: ShiftFormState,
  formData: FormData,
): Promise<ShiftFormState> {
  const swapRequestId = toPositiveIntId(formData.get("swap_request_id"))

  if (swapRequestId === null) {
    return { ok: false, error: "申請 ID が不正です" }
  }

  const cancelled = await cancelShiftSwapRequest(swapRequestId)

  if (cancelled instanceof Error) {
    return { ok: false, error: cancelled.message }
  }

  revalidatePath("/shift")

  return { ok: true, error: null }
}

// パターン編集フォームの必須フィールドを検証して取り出す。不足時は Error を返す。
function toPatternFields(
  formData: FormData,
):
  | { code: string; name: string; start_time: string; end_time: string; break_minutes: number }
  | Error {
  const code = trimmedOrEmpty(formData.get("code"))

  const name = trimmedOrEmpty(formData.get("name"))

  const startTime = trimmedOrEmpty(formData.get("start_time"))

  const endTime = trimmedOrEmpty(formData.get("end_time"))

  if (code === "" || name === "" || startTime === "" || endTime === "") {
    return new Error("コード・名前・開始・終了を入力してください")
  }

  const breakText = trimmedOrEmpty(formData.get("break_minutes"))

  const breakMinutes = breakText === "" ? 0 : Number(breakText)

  if (Number.isInteger(breakMinutes) === false || breakMinutes < 0) {
    return new Error("休憩時間は整数で入力してください")
  }

  return { code, name, start_time: startTime, end_time: endTime, break_minutes: breakMinutes }
}

// FormData 値を trim した文字列に。未入力や非文字列は空文字。
function trimmedOrEmpty(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : ""
}

// FormData 値を trim した文字列に。未入力や空は null。
function trimmedOrNull(value: FormDataEntryValue | null): string | null {
  const trimmed = trimmedOrEmpty(value)

  return trimmed === "" ? null : trimmed
}
