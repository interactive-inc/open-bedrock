"use server"

import { revalidatePath } from "next/cache"
import { cancelBusinessTrip } from "@/lib/api/cancel-business-trip"
import { createBusinessTrip } from "@/lib/api/create-business-trip"
import { updateBusinessTrip } from "@/lib/api/update-business-trip"
import {
  FORM_CONSTRAINTS,
  toOptionalIntInRange,
  toRequiredIsoDate,
  toRequiredText,
} from "@/lib/form/constraints"

// useActionState で参照する共通の戻り値。ok=成功 / error=表示するエラー文言。
export type BusinessTripActionState = {
  ok: boolean
  error: string | null
}

// 出張申請作成 Server Action。destination/start_date/end_date/purpose 必須、estimated_cost は任意。
// 成功時は /business-trips を revalidate して一覧へ反映する。
export async function createBusinessTripAction(
  previousState: BusinessTripActionState,
  formData: FormData,
): Promise<BusinessTripActionState> {
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
