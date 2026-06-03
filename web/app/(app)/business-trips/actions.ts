"use server"

import { revalidatePath } from "next/cache"
import { cancelBusinessTrip } from "@/lib/api/cancel-business-trip"
import { createBusinessTrip } from "@/lib/api/create-business-trip"
import { updateBusinessTrip } from "@/lib/api/update-business-trip"

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
    return { ok: false, error: "出張申請の作成に失敗しました" }
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
    return { ok: false, error: "出張申請の変更に失敗しました" }
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
    return { ok: false, error: "出張申請の取消に失敗しました" }
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
  const destination = formData.get("destination")

  const startDate = formData.get("start_date")

  const endDate = formData.get("end_date")

  const purpose = formData.get("purpose")

  if (typeof destination !== "string" || destination.trim() === "") {
    return new Error("行き先を入力してください")
  }

  if (typeof startDate !== "string" || startDate === "") {
    return new Error("開始日を入力してください")
  }

  if (typeof endDate !== "string" || endDate === "") {
    return new Error("終了日を入力してください")
  }

  if (endDate < startDate) {
    return new Error("終了日は開始日以降にしてください")
  }

  if (typeof purpose !== "string" || purpose.trim() === "") {
    return new Error("目的を入力してください")
  }

  return {
    destination: destination.trim(),
    start_date: startDate,
    end_date: endDate,
    purpose: purpose.trim(),
    estimated_cost: toEstimatedCost(formData.get("estimated_cost")),
  }
}

// estimated_cost の FormData 値を数値へ。未入力や不正値は null。
function toEstimatedCost(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || value.trim() === "") {
    return null
  }

  const parsed = Number(value)

  if (Number.isInteger(parsed) === false || parsed < 0) {
    return null
  }

  return parsed
}
