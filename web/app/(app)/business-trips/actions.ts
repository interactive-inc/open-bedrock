"use server"

import { revalidatePath } from "next/cache"
import { approveBusinessTrip } from "@/lib/api/approve-business-trip"
import { cancelBusinessTrip } from "@/lib/api/cancel-business-trip"
import { createBusinessTrip } from "@/lib/api/create-business-trip"
import { getMe } from "@/lib/api/get-me"
import { rejectBusinessTrip } from "@/lib/api/reject-business-trip"
import { updateBusinessTrip } from "@/lib/api/update-business-trip"
import { canManageBusinessTrips } from "@/lib/business-trip/can-manage-business-trips"
import {
  FORM_CONSTRAINTS,
  toOptionalIntInRange,
  toRequiredIsoDate,
  toRequiredText,
} from "@/lib/form/constraints"
import { requireAuth } from "@/lib/auth/require-auth"

// useActionState で参照する共通の戻り値。ok=成功 / error=表示するエラー文言。
export type BusinessTripActionState = {
  ok: boolean
  error: string | null
}

// 人事が出張申請を承認する Server Action。business_trip_id 必須。
// permission を確認してから API を叩き、成功時は admin 一覧を revalidate する。
export async function approveBusinessTripAction(
  previousState: BusinessTripActionState,
  formData: FormData,
): Promise<BusinessTripActionState> {
  const id = toBusinessTripIdText(formData.get("business_trip_id"))

  if (id === null) {
    return { ok: false, error: "申請を特定できませんでした" }
  }

  const currentUser = await getMe()

  if (currentUser instanceof Error || canManageBusinessTrips(currentUser.permissions) === false) {
    return { ok: false, error: "出張申請を管理する権限がありません" }
  }

  const approved = await approveBusinessTrip(id)

  if (approved instanceof Error) {
    return { ok: false, error: approved.message }
  }

  revalidatePath("/business-trips/admin")

  return { ok: true, error: null }
}

// 人事が出張申請を却下する Server Action。business_trip_id 必須。
// permission を確認してから API を叩き、成功時は admin 一覧を revalidate する。
export async function rejectBusinessTripAction(
  previousState: BusinessTripActionState,
  formData: FormData,
): Promise<BusinessTripActionState> {
  const id = toBusinessTripIdText(formData.get("business_trip_id"))

  if (id === null) {
    return { ok: false, error: "申請を特定できませんでした" }
  }

  const currentUser = await getMe()

  if (currentUser instanceof Error || canManageBusinessTrips(currentUser.permissions) === false) {
    return { ok: false, error: "出張申請を管理する権限がありません" }
  }

  const rejected = await rejectBusinessTrip(id)

  if (rejected instanceof Error) {
    return { ok: false, error: rejected.message }
  }

  revalidatePath("/business-trips/admin")

  return { ok: true, error: null }
}

// id 用の FormData 値を取り出す。未入力は null。
function toBusinessTripIdText(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string" || value.trim() === "") {
    return null
  }

  return value.trim()
}

// 出張申請作成 Server Action。destination/start_date/end_date/purpose 必須、estimated_cost は任意。
// 成功時は /business-trips を revalidate して一覧へ反映する。
export async function createBusinessTripAction(
  previousState: BusinessTripActionState,
  formData: FormData,
): Promise<BusinessTripActionState> {
  await requireAuth()

  const fields = toTripFields(formData)

  if (fields instanceof Error) {
    return { ok: false, error: fields.message }
  }

  const created = await createBusinessTrip(fields)

  if (created instanceof Error) {
    return { ok: false, error: created.message }
  }

  revalidatePath("/business-trips")

  return { ok: true, error: null }
}

// 出張申請変更 Server Action。business_trip_id 必須。本人以外の変更は api がエラーを返す。
export async function updateBusinessTripAction(
  previousState: BusinessTripActionState,
  formData: FormData,
): Promise<BusinessTripActionState> {
  await requireAuth()

  const businessTripId = formData.get("business_trip_id")

  if (typeof businessTripId !== "string" || businessTripId === "") {
    return { ok: false, error: "出張申請を特定できませんでした" }
  }

  const fields = toTripFields(formData)

  if (fields instanceof Error) {
    return { ok: false, error: fields.message }
  }

  const updated = await updateBusinessTrip(businessTripId, fields)

  if (updated instanceof Error) {
    return { ok: false, error: updated.message }
  }

  revalidatePath("/business-trips")

  return { ok: true, error: null }
}

// 出張申請取消 Server Action。business_trip_id 必須。成功時は /business-trips を revalidate する。
export async function cancelBusinessTripAction(
  previousState: BusinessTripActionState,
  formData: FormData,
): Promise<BusinessTripActionState> {
  await requireAuth()

  const businessTripId = formData.get("business_trip_id")

  if (typeof businessTripId !== "string" || businessTripId === "") {
    return { ok: false, error: "出張申請を特定できませんでした" }
  }

  const cancelled = await cancelBusinessTrip(businessTripId)

  if (cancelled instanceof Error) {
    return { ok: false, error: cancelled.message }
  }

  revalidatePath("/business-trips")

  return { ok: true, error: null }
}

type TripFields = {
  destination: string
  start_date: string
  end_date: string
  purpose: string
  estimated_cost: number | null
}

// FormData から出張申請の共通フィールドを取り出して検証する。不正時は Error。
function toTripFields(formData: FormData): TripFields | Error {
  const destination = toRequiredText(formData.get("destination"), {
    label: "行き先",
    max: FORM_CONSTRAINTS.businessTrip.destinationMax,
  })

  if (destination instanceof Error) {
    return destination
  }

  const startDate = toRequiredIsoDate(formData.get("start_date"), "開始日")

  if (startDate instanceof Error) {
    return startDate
  }

  const endDate = toRequiredIsoDate(formData.get("end_date"), "終了日")

  if (endDate instanceof Error) {
    return endDate
  }

  if (endDate < startDate) {
    return new Error("終了日は開始日以降にしてください")
  }

  const purpose = toRequiredText(formData.get("purpose"), {
    label: "目的",
    max: FORM_CONSTRAINTS.businessTrip.purposeMax,
  })

  if (purpose instanceof Error) {
    return purpose
  }

  const estimatedCost = toOptionalIntInRange(formData.get("estimated_cost"), {
    label: "概算費用",
    min: FORM_CONSTRAINTS.businessTrip.estimatedCostMin,
    max: Number.MAX_SAFE_INTEGER,
  })

  if (estimatedCost instanceof Error) {
    return estimatedCost
  }

  return {
    destination,
    start_date: startDate,
    end_date: endDate,
    purpose,
    estimated_cost: estimatedCost,
  }
}
