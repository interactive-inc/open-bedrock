"use server"

import { revalidatePath } from "next/cache"
import { approveLifeEvent } from "@/lib/api/approve-life-event"
import { cancelLifeEvent } from "@/lib/api/cancel-life-event"
import { createLifeEvent } from "@/lib/api/create-life-event"
import { getMe } from "@/lib/api/get-me"
import { rejectLifeEvent } from "@/lib/api/reject-life-event"
import { updateLifeEvent } from "@/lib/api/update-life-event"
import { FORM_CONSTRAINTS } from "@/lib/form/constraints"
import { toOptionalText } from "@/lib/form/to-optional-text"
import { toRequiredIsoDate } from "@/lib/form/to-required-iso-date"
import { toRequiredText } from "@/lib/form/to-required-text"
import { canManageLifeEvents } from "@/lib/life-event/can-manage-life-events"
import { requireAuth } from "@/lib/auth/require-auth"

/** useActionState で参照する共通の戻り値。ok=成功 / error=表示するエラー文言。 */
export type LifeEventActionState = {
  ok: boolean
  error: string | null
}

/**
 * 人事がライフイベント届出を承認する Server Action。life_event_id 必須。
 * permission を確認してから API を叩き、成功時は admin 一覧を revalidate する。
 */
export async function approveLifeEventAction(
  previousState: LifeEventActionState,
  formData: FormData,
): Promise<LifeEventActionState> {
  const id = toLifeEventIdText(formData.get("life_event_id"))

  if (id === null) {
    return { ok: false, error: "届出を特定できませんでした" }
  }

  const currentUser = await getMe()

  if (currentUser instanceof Error || canManageLifeEvents(currentUser.permissions) === false) {
    return { ok: false, error: "ライフイベント届出を管理する権限がありません" }
  }

  const approved = await approveLifeEvent(id)

  if (approved instanceof Error) {
    return { ok: false, error: approved.message }
  }

  revalidatePath("/organization/life-events")

  return { ok: true, error: null }
}

/**
 * 人事がライフイベント届出を却下する Server Action。life_event_id 必須。
 * permission を確認してから API を叩き、成功時は admin 一覧を revalidate する。
 */
export async function rejectLifeEventAction(
  previousState: LifeEventActionState,
  formData: FormData,
): Promise<LifeEventActionState> {
  const id = toLifeEventIdText(formData.get("life_event_id"))

  if (id === null) {
    return { ok: false, error: "届出を特定できませんでした" }
  }

  const currentUser = await getMe()

  if (currentUser instanceof Error || canManageLifeEvents(currentUser.permissions) === false) {
    return { ok: false, error: "ライフイベント届出を管理する権限がありません" }
  }

  const rejected = await rejectLifeEvent(id)

  if (rejected instanceof Error) {
    return { ok: false, error: rejected.message }
  }

  revalidatePath("/organization/life-events")

  return { ok: true, error: null }
}

/** id 用の FormData 値を取り出す。未入力は null。 */
function toLifeEventIdText(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string" || value.trim() === "") {
    return null
  }

  return value.trim()
}

/**
 * ライフイベント届出作成 Server Action。event_type/event_date 必須、detail は任意。
 * 成功時は /life-events を revalidate して一覧へ反映する。
 */
export async function createLifeEventAction(
  previousState: LifeEventActionState,
  formData: FormData,
): Promise<LifeEventActionState> {
  await requireAuth()

  const fields = toEventFields(formData)

  if (fields instanceof Error) {
    return { ok: false, error: fields.message }
  }

  const created = await createLifeEvent(fields)

  if (created instanceof Error) {
    return { ok: false, error: created.message }
  }

  revalidatePath("/my/life-events")

  return { ok: true, error: null }
}

/** ライフイベント届出変更 Server Action。life_event_id 必須。本人以外の変更は api がエラーを返す。 */
export async function updateLifeEventAction(
  previousState: LifeEventActionState,
  formData: FormData,
): Promise<LifeEventActionState> {
  await requireAuth()

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
    return { ok: false, error: updated.message }
  }

  revalidatePath("/my/life-events")

  return { ok: true, error: null }
}

/** ライフイベント届出取消 Server Action。life_event_id 必須。成功時は /life-events を revalidate する。 */
export async function cancelLifeEventAction(
  previousState: LifeEventActionState,
  formData: FormData,
): Promise<LifeEventActionState> {
  await requireAuth()

  const lifeEventId = formData.get("life_event_id")

  if (typeof lifeEventId !== "string" || lifeEventId === "") {
    return { ok: false, error: "ライフイベント届出を特定できませんでした" }
  }

  const cancelled = await cancelLifeEvent(lifeEventId)

  if (cancelled instanceof Error) {
    return { ok: false, error: cancelled.message }
  }

  revalidatePath("/my/life-events")

  return { ok: true, error: null }
}

type EventFields = {
  event_type: string
  event_date: string
  detail: string | null
}

/** FormData からライフイベント届出の共通フィールドを取り出して検証する。不正時は Error。 */
function toEventFields(formData: FormData): EventFields | Error {
  const eventType = toRequiredText(formData.get("event_type"), {
    label: "種別",
    max: FORM_CONSTRAINTS.lifeEvent.eventTypeMax,
  })

  if (eventType instanceof Error) {
    return eventType
  }

  const eventDate = toRequiredIsoDate(formData.get("event_date"), "発生日")

  if (eventDate instanceof Error) {
    return eventDate
  }

  const detail = toOptionalText(formData.get("detail"), {
    label: "詳細",
    max: FORM_CONSTRAINTS.lifeEvent.detailMax,
  })

  if (detail instanceof Error) {
    return detail
  }

  return {
    event_type: eventType,
    event_date: eventDate,
    detail: detail,
  }
}
