"use server"

import { revalidatePath } from "next/cache"
import { createShiftAssignment } from "@/lib/api/create-shift-assignment"
import { createShiftPattern } from "@/lib/api/create-shift-pattern"
import { createShiftSwapRequest } from "@/lib/api/create-shift-swap-request"
import { publishShiftAssignment } from "@/lib/api/publish-shift-assignment"

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
    return { ok: false, error: "交代申請の作成に失敗しました" }
  }

  revalidatePath("/shift")

  return { ok: true, error: null }
}

// シフト割当作成 Server Action（特権ロール）。employee_code/pattern_code/date 必須、note 任意。
export async function createShiftAssignmentAction(
  _previousState: ShiftFormState,
  formData: FormData,
): Promise<ShiftFormState> {
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

  const note = typeof noteValue === "string" && noteValue.trim() !== "" ? noteValue.trim() : null

  const created = await createShiftAssignment({
    employee_code: employeeCode,
    pattern_code: patternCode,
    date: date,
    note: note,
  })

  if (created instanceof Error) {
    return { ok: false, error: "シフト割当の作成に失敗しました" }
  }

  revalidatePath("/shift")

  return { ok: true, error: null }
}

// シフト割当公開 Server Action（特権ロール）。hidden input の assignment_id を受け取る。
export async function publishShiftAssignmentAction(
  _previousState: ShiftFormState,
  formData: FormData,
): Promise<ShiftFormState> {
  const assignmentId = Number(formData.get("assignment_id"))

  if (Number.isInteger(assignmentId) === false) {
    return { ok: false, error: "割当 ID が不正です" }
  }

  const published = await publishShiftAssignment(assignmentId)

  if (published instanceof Error) {
    return { ok: false, error: "シフト割当の公開に失敗しました" }
  }

  revalidatePath("/shift")

  return { ok: true, error: null }
}

// シフトパターン作成 Server Action（特権ロール）。code/name/start_time/end_time 必須、break_minutes 任意。
export async function createShiftPatternAction(
  _previousState: ShiftFormState,
  formData: FormData,
): Promise<ShiftFormState> {
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

  if (breakMinutes !== null && Number.isInteger(breakMinutes) === false) {
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
    return { ok: false, error: "シフトパターンの作成に失敗しました" }
  }

  revalidatePath("/shift")

  return { ok: true, error: null }
}

// シフト交代承認 Server Action（特権ロール）。hidden input の swap_request_id を受け取る。
export async function approveShiftSwapRequestAction(
  _previousState: ShiftFormState,
  formData: FormData,
): Promise<ShiftFormState> {
  const swapRequestId = Number(formData.get("swap_request_id"))

  if (Number.isInteger(swapRequestId) === false) {
    return { ok: false, error: "交代申請 ID が不正です" }
  }

  const approved = await approveShiftSwapRequest(swapRequestId)

  if (approved instanceof Error) {
    return { ok: false, error: "交代申請の承認に失敗しました" }
  }

  revalidatePath("/shift")

  return { ok: true, error: null }
}
