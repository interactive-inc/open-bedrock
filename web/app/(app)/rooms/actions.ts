"use server"

import { revalidatePath } from "next/cache"
import { createRoomReservation } from "@/lib/api/create-room-reservation"

// useActionState で参照する共通の戻り値。ok=成功 / error=表示するエラー文言。
export type RoomReservationActionState = {
  ok: boolean
  error: string | null
}

// 会議室予約作成 Server Action。room_id/start_at/end_at 必須、purpose は任意。
// 期間が重複すると api が 409 を返し Error になる。成功時は /rooms を revalidate して空き状況へ反映する。
export async function createRoomReservationAction(
  previousState: RoomReservationActionState,
  formData: FormData,
): Promise<RoomReservationActionState> {
  const roomId = toRoomId(formData.get("room_id"))

  if (roomId === null) {
    return { ok: false, error: "会議室を選択してください" }
  }

  const startAt = formData.get("start_at")

  const endAt = formData.get("end_at")

  if (typeof startAt !== "string" || startAt === "") {
    return { ok: false, error: "開始日時を入力してください" }
  }

  if (typeof endAt !== "string" || endAt === "") {
    return { ok: false, error: "終了日時を入力してください" }
  }

  if (endAt <= startAt) {
    return { ok: false, error: "終了日時は開始日時より後にしてください" }
  }

  const purpose = toPurpose(formData.get("purpose"))

  const created = await createRoomReservation({
    room_id: roomId,
    start_at: startAt,
    end_at: endAt,
    purpose: purpose,
  })

  if (created instanceof Error) {
    return {
      ok: false,
      error: "予約の作成に失敗しました（時間帯が重複している可能性があります）",
    }
  }

  revalidatePath("/rooms")

  return { ok: true, error: null }
}

// room_id の FormData 値を数値へ。未入力や不正値は null。
function toRoomId(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || value === "") {
    return null
  }

  const parsed = Number(value)

  if (Number.isInteger(parsed) === false) {
    return null
  }

  return parsed
}

// purpose の FormData 値を文字列へ。未入力や不正値は null。
function toPurpose(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string" || value.trim() === "") {
    return null
  }

  return value.trim()
}
