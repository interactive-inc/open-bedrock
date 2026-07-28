"use server"

import { revalidatePath } from "next/cache"
import { createCalendarDay } from "@/lib/api/create-calendar-day"
import { deleteCalendarDay } from "@/lib/api/delete-calendar-day"
import type { CalendarDayKind } from "@/lib/api/types/calendar-types"

/** useActionState で参照する共通の戻り値。ok=成功 / error=表示するエラー文言。 */
export type CalendarActionState = {
  ok: boolean
  error: string | null
}

const NAME_MAX = 200

/** 会社休日・振替出勤日を登録する Server Action。calendar:manage が無いと api が 403 を返し Error になる。 */
export async function createCalendarDayAction(
  previousState: CalendarActionState,
  formData: FormData,
): Promise<CalendarActionState> {
  const calendarDate = toRequiredDate(formData.get("calendar_date"))

  if (calendarDate instanceof Error) {
    return { ok: false, error: calendarDate.message }
  }

  const kind = toKind(formData.get("kind"))

  if (kind instanceof Error) {
    return { ok: false, error: kind.message }
  }

  const name = toName(formData.get("name"))

  if (name instanceof Error) {
    return { ok: false, error: name.message }
  }

  const created = await createCalendarDay({
    calendar_date: calendarDate,
    kind,
    name,
  })

  if (created instanceof Error) {
    return { ok: false, error: "登録に失敗しました（権限や日付の重複を確認してください）" }
  }

  revalidatePath("/organization/calendars")

  return { ok: true, error: null }
}

/** 会社カレンダーの 1 日を削除する Server Action。id は hidden フィールドから受け取る。 */
export async function deleteCalendarDayAction(
  previousState: CalendarActionState,
  formData: FormData,
): Promise<CalendarActionState> {
  const idValue = formData.get("id")

  const id = typeof idValue === "string" ? Number(idValue) : Number.NaN

  if (Number.isInteger(id) === false || id <= 0) {
    return { ok: false, error: "削除対象が不正です" }
  }

  const deleted = await deleteCalendarDay(id)

  if (deleted instanceof Error) {
    return { ok: false, error: "削除に失敗しました（権限を確認してください）" }
  }

  revalidatePath("/organization/calendars")

  return { ok: true, error: null }
}

/** YYYY-MM-DD の必須日付を検証する。 */
function toRequiredDate(value: FormDataEntryValue | null): string | Error {
  if (typeof value !== "string" || /^\d{4}-\d{2}-\d{2}$/.test(value) === false) {
    return new Error("日付を YYYY-MM-DD 形式で入力してください")
  }

  return value
}

/** kind を holiday / workday に限定する。 */
function toKind(value: FormDataEntryValue | null): CalendarDayKind | Error {
  if (value === "holiday" || value === "workday") {
    return value
  }

  return new Error("種別を選択してください")
}

/** name は任意。空文字は null、長すぎる場合はエラー。 */
function toName(value: FormDataEntryValue | null): string | null | Error {
  if (typeof value !== "string" || value === "") {
    return null
  }

  if (value.length > NAME_MAX) {
    return new Error(`名称は ${NAME_MAX} 文字以内で入力してください`)
  }

  return value
}
