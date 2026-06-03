"use server"

import { revalidatePath } from "next/cache"
import { cancelLifeEvent } from "@/lib/api/cancel-life-event"
import { createLifeEvent } from "@/lib/api/create-life-event"
import { updateLifeEvent } from "@/lib/api/update-life-event"

// useActionState で参照する共通の戻り値。ok=成功 / error=表示するエラー文言。
export type LifeEventActionState = {
  ok: boolean
  error: string | null
}

// ライフイベント届出作成 Server Action。event_type/event_date 必須、detail は任意。
// 成功時は /life-events を revalidate して一覧へ反映する。
export async function createLifeEventAction(
  previousState: LifeEventActionState,
  formData: FormData,
): Promise<LifeEventActionState> {
  const fields = toEventFields(formData)

  if (fields instanceof Error) {
    return { ok: false, error: fields.message }
  }

  const created = await createLifeEvent(fields)

  if (created instanceof Error) {
    return { ok: false, error: "ライフイベント届出の作成に失敗しました" }
  }

  revalidatePath("/life-events")

  return { ok: true, error: null }
}

// ライフイベント届出変更 Server Action。life_event_id 必須。本人以外の変更は api がエラーを返す。
export async function updateLifeEventAction(
  previousState: LifeEventActionState,
  formData: FormData,
): Promise<LifeEventActionState> {
  const lifeEventId = formData.get("life_event_id")

  if (typeof lifeEventId !== "string" || lifeEventId === "") {
    return { ok: false, error: "ライフイベント届出を特定できませんでした" }
  }

  const fields = toEventFields(formData)

  if (fields instanceof Error) {
    return { ok: false, error: fields.message }
  }

  const updated = await updateLifeEvent(lifeEventId, fields)

  if (updated instanceof Error) {
    return { ok: false, error: "ライフイベント届出の変更に失敗しました" }
  }

  revalidatePath("/life-events")

  return { ok: true, error: null }
}

// ライフイベント届出取消 Server Action。life_event_id 必須。成功時は /life-events を revalidate する。
export async function cancelLifeEventAction(
  previousState: LifeEventActionState,
  formData: FormData,
): Promise<LifeEventActionState> {
  const lifeEventId = formData.get("life_event_id")

  if (typeof lifeEventId !== "string" || lifeEventId === "") {
    return { ok: false, error: "ライフイベント届出を特定できませんでした" }
  }

  const cancelled = await cancelLifeEvent(lifeEventId)

  if (cancelled instanceof Error) {
    return { ok: false, error: "ライフイベント届出の取消に失敗しました" }
  }

  revalidatePath("/life-events")

  return { ok: true, error: null }
}

type EventFields = {
  event_type: string
  event_date: string
  detail: string | null
}

// FormData からライフイベント届出の共通フィールドを取り出して検証する。不正時は Error。
function toEventFields(formData: FormData): EventFields | Error {
  const eventType = formData.get("event_type")

  const eventDate = formData.get("event_date")

  const detail = formData.get("detail")

  if (typeof eventType !== "string" || eventType.trim() === "") {
    return new Error("種別を入力してください")
  }

  if (typeof eventDate !== "string" || eventDate === "") {
    return new Error("発生日を入力してください")
  }

  return {
    event_type: eventType.trim(),
    event_date: eventDate,
    detail: toDetail(detail),
  }
}

// detail の FormData 値を文字列へ。未入力は null。
function toDetail(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string" || value.trim() === "") {
    return null
  }

  return value.trim()
}
