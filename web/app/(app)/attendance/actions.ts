"use server"

import { revalidatePath } from "next/cache"
import { clockInAttendance } from "@/lib/api/clock-in-attendance"
import { clockOutAttendance } from "@/lib/api/clock-out-attendance"

// useActionState で参照する共通の戻り値。ok=成功 / error=表示するエラー文言。
export type AttendanceActionState = {
  ok: boolean
  error: string | null
}

// 出勤打刻 Server Action。note は任意。既に打刻中なら api が 409 を返し Error になる。
// 成功時は /attendance を revalidate して本人の勤怠と一覧へ反映する。
export async function clockInAction(
  previousState: AttendanceActionState,
  formData: FormData,
): Promise<AttendanceActionState> {
  const note = toNote(formData.get("note"))

  const record = await clockInAttendance({ note })

  if (record instanceof Error) {
    return { ok: false, error: record.message }
  }

  revalidatePath("/attendance")

  return { ok: true, error: null }
}

// 退勤打刻 Server Action。note は任意。打刻中でないなら api が 409 を返し Error になる。
// 成功時は /attendance を revalidate して本人の勤怠と一覧へ反映する。
export async function clockOutAction(
  previousState: AttendanceActionState,
  formData: FormData,
): Promise<AttendanceActionState> {
  const note = toNote(formData.get("note"))

  const record = await clockOutAttendance({ note })

  if (record instanceof Error) {
    return { ok: false, error: record.message }
  }

  revalidatePath("/attendance")

  return { ok: true, error: null }
}

// note の FormData 値を文字列へ。未入力や不正値は null。
function toNote(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string" || value === "") {
    return null
  }

  return value
}
