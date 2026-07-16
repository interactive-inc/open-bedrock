"use server"

import { revalidatePath } from "next/cache"
import { clockInAttendance } from "@/lib/api/clock-in-attendance"
import { clockOutAttendance } from "@/lib/api/clock-out-attendance"
import { requireAuth } from "@/lib/auth/require-auth"

// useActionState で参照する共通の戻り値。ok=成功 / error=表示するエラー文言。
// clockedAt は打刻成功時の時刻（HH:mm 形式）。フォーム内での視覚フィードバックに使う。
export type AttendanceActionState = {
  ok: boolean
  error: string | null
  clockedAt: string | null
}

// 出勤打刻 Server Action。note は任意。既に打刻中なら api が 409 を返し Error になる。
// 成功時は /attendance を revalidate して本人の勤怠と一覧へ反映する。
export async function clockInAction(
  previousState: AttendanceActionState,
  formData: FormData,
): Promise<AttendanceActionState> {
  await requireAuth()

  const note = toNote(formData.get("note"))

  const record = await clockInAttendance({ note })

  if (record instanceof Error) {
    return { ok: false, error: record.message, clockedAt: null }
  }

  revalidatePath("/attendance")

  return { ok: true, error: null, clockedAt: toTimeString() }
}

// 退勤打刻 Server Action。note は任意。打刻中でないなら api が 409 を返し Error になる。
// 成功時は /attendance を revalidate して本人の勤怠と一覧へ反映する。
export async function clockOutAction(
  previousState: AttendanceActionState,
  formData: FormData,
): Promise<AttendanceActionState> {
  await requireAuth()

  const note = toNote(formData.get("note"))

  const record = await clockOutAttendance({ note })

  if (record instanceof Error) {
    return { ok: false, error: record.message, clockedAt: null }
  }

  revalidatePath("/attendance")

  return { ok: true, error: null, clockedAt: toTimeString() }
}

// 現在時刻を HH:mm 形式の文字列で返す（JST）。
function toTimeString(): string {
  return new Date().toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  })
}

// note の FormData 値を文字列へ。未入力や不正値は null。
function toNote(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string" || value === "") {
    return null
  }

  return value
}
