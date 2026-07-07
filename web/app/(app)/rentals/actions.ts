"use server"

import { revalidatePath } from "next/cache"
import { cancelRentalReservation } from "@/lib/api/cancel-rental-reservation"
import { createRentalReservation } from "@/lib/api/create-rental-reservation"
import { getMe } from "@/lib/api/get-me"
import { lendRentalReservation } from "@/lib/api/lend-rental-reservation"
import { returnRentalReservation } from "@/lib/api/return-rental-reservation"
import { updateRentalReservation } from "@/lib/api/update-rental-reservation"
import { canManageRentals } from "@/lib/rental/can-manage-rentals"

// useActionState で参照する共通の戻り値。ok=成功 / error=表示するエラー文言。
export type RentalReservationActionState = {
  ok: boolean
  error: string | null
}

// 総務・人事が貸与品予約を貸出済みにする Server Action。reservation_id 必須。
// permission を確認してから API を叩き、成功時は admin 一覧を revalidate する。
export async function lendRentalReservationAction(
  previousState: RentalReservationActionState,
  formData: FormData,
): Promise<RentalReservationActionState> {
  const id = toReservationIdText(formData.get("reservation_id"))

  if (id === null) {
    return { ok: false, error: "予約を特定できませんでした" }
  }

  const currentUser = await getMe()

  if (currentUser instanceof Error || canManageRentals(currentUser.permissions) === false) {
    return { ok: false, error: "貸与品予約を管理する権限がありません" }
  }

  const lent = await lendRentalReservation(id)

  if (lent instanceof Error) {
    return { ok: false, error: lent.message }
  }

  revalidatePath("/rentals/admin")

  return { ok: true, error: null }
}

// 総務・人事が貸与品予約を返却済みにする Server Action。reservation_id 必須。
// permission を確認してから API を叩き、成功時は admin 一覧を revalidate する。
export async function returnRentalReservationAction(
  previousState: RentalReservationActionState,
  formData: FormData,
): Promise<RentalReservationActionState> {
  const id = toReservationIdText(formData.get("reservation_id"))

  if (id === null) {
    return { ok: false, error: "予約を特定できませんでした" }
  }

  const currentUser = await getMe()

  if (currentUser instanceof Error || canManageRentals(currentUser.permissions) === false) {
    return { ok: false, error: "貸与品予約を管理する権限がありません" }
  }

  const returned = await returnRentalReservation(id)

  if (returned instanceof Error) {
    return { ok: false, error: returned.message }
  }

  revalidatePath("/rentals/admin")

  return { ok: true, error: null }
}

// id 用の FormData 値を取り出す。未入力は null。
function toReservationIdText(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string" || value.trim() === "") {
    return null
  }

  return value.trim()
}

// レンタル予約申請 Server Action。item_name/start_date/end_date 必須、purpose は任意。
// 成功時は /rentals を revalidate して一覧へ反映する。
export async function createRentalReservationAction(
  previousState: RentalReservationActionState,
  formData: FormData,
): Promise<RentalReservationActionState> {
  const itemName = toText(formData.get("item_name"))

  if (itemName === null) {
    return { ok: false, error: "品名を入力してください" }
  }

  const startDate = toText(formData.get("start_date"))

  const endDate = toText(formData.get("end_date"))

  if (startDate === null) {
    return { ok: false, error: "開始日を入力してください" }
  }

  if (endDate === null) {
    return { ok: false, error: "終了日を入力してください" }
  }

  if (endDate < startDate) {
    return { ok: false, error: "終了日は開始日以降にしてください" }
  }

  const created = await createRentalReservation({
    item_name: itemName,
    start_date: startDate,
    end_date: endDate,
    purpose: toText(formData.get("purpose")),
  })

  if (created instanceof Error) {
    return { ok: false, error: created.message }
  }

  revalidatePath("/rentals")

  return { ok: true, error: null }
}

// レンタル予約変更 Server Action。reservation_id/item_name/start_date/end_date 必須、purpose は任意。
// 本人以外の変更は api がエラーを返す。成功時は /rentals を revalidate する。
export async function updateRentalReservationAction(
  previousState: RentalReservationActionState,
  formData: FormData,
): Promise<RentalReservationActionState> {
  const reservationId = toText(formData.get("reservation_id"))

  if (reservationId === null) {
    return { ok: false, error: "予約を特定できませんでした" }
  }

  const itemName = toText(formData.get("item_name"))

  const startDate = toText(formData.get("start_date"))

  const endDate = toText(formData.get("end_date"))

  if (itemName === null) {
    return { ok: false, error: "品名を入力してください" }
  }

  if (startDate === null || endDate === null) {
    return { ok: false, error: "開始日と終了日を入力してください" }
  }

  if (endDate < startDate) {
    return { ok: false, error: "終了日は開始日以降にしてください" }
  }

  const updated = await updateRentalReservation(reservationId, {
    item_name: itemName,
    start_date: startDate,
    end_date: endDate,
    purpose: toText(formData.get("purpose")),
  })

  if (updated instanceof Error) {
    return { ok: false, error: updated.message }
  }

  revalidatePath("/rentals")

  return { ok: true, error: null }
}

// レンタル予約取消 Server Action。reservation_id 必須。成功時は /rentals を revalidate する。
export async function cancelRentalReservationAction(
  previousState: RentalReservationActionState,
  formData: FormData,
): Promise<RentalReservationActionState> {
  const reservationId = toText(formData.get("reservation_id"))

  if (reservationId === null) {
    return { ok: false, error: "予約を特定できませんでした" }
  }

  const cancelled = await cancelRentalReservation(reservationId)

  if (cancelled instanceof Error) {
    return { ok: false, error: cancelled.message }
  }

  revalidatePath("/rentals")

  return { ok: true, error: null }
}

// FormData 値を trim した文字列へ。未入力や空文字は null。
function toText(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string" || value.trim() === "") {
    return null
  }

  return value.trim()
}
