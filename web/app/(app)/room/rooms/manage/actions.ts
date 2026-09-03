"use server"

import { revalidatePath } from "next/cache"
import { createRoom } from "@/lib/api/create-room"
import { deleteRoom } from "@/lib/api/delete-room"
import { getMe } from "@/lib/api/get-me"
import { updateRoom } from "@/lib/api/update-room"
import { toPositiveIntId } from "@/lib/form/to-positive-int-id"
import { canManageRooms } from "@/lib/room/can-manage-rooms"

export type RoomCreateFormState = {
  ok: boolean
  error: string | null
}

export type RoomUpdateFormState = {
  ok: boolean
  error: string | null
}

export type RoomDeleteFormState = {
  ok: boolean
  error: string | null
}

/** FormData の文字列を正の整数へ検証付きで変換する。不正なら null。 */
function toCapacity(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string") {
    return null
  }

  const parsed = Number(value)

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null
  }

  return parsed
}

/**
 * 会議室登録の Server Action。location の空文字は値なし扱いにする。
 * Server Action は直接呼べるため getMe のロールで二重に弾く（defense-in-depth）。
 */
export async function createRoomAction(
  previousState: RoomCreateFormState,
  formData: FormData,
): Promise<RoomCreateFormState> {
  const me = await getMe()

  if (me instanceof Error || !canManageRooms(me.permissions)) {
    return { ok: false, error: "権限がありません" }
  }

  const nameValue = formData.get("name")

  const name = typeof nameValue === "string" ? nameValue : ""

  if (name === "") {
    return { ok: false, error: "名称を入力してください" }
  }

  const capacity = toCapacity(formData.get("capacity"))

  if (capacity === null) {
    return { ok: false, error: "定員は正の整数で入力してください" }
  }

  const locationValue = formData.get("location")

  const location = typeof locationValue === "string" && locationValue !== "" ? locationValue : null

  const created = await createRoom({ name: name, capacity: capacity, location: location })

  if (created instanceof Error) {
    return { ok: false, error: created.message }
  }

  revalidatePath("/room/rooms/manage")
  revalidatePath("/room/rooms")

  return { ok: true, error: null }
}

/**
 * 会議室編集の Server Action。id は hidden、名称・定員・所在地を更新する。
 * Server Action は直接呼べるため getMe のロールで二重に弾く（defense-in-depth）。
 */
export async function updateRoomAction(
  previousState: RoomUpdateFormState,
  formData: FormData,
): Promise<RoomUpdateFormState> {
  const me = await getMe()

  if (me instanceof Error || !canManageRooms(me.permissions)) {
    return { ok: false, error: "権限がありません" }
  }

  const roomId = toPositiveIntId(formData.get("id"))

  if (roomId === null) {
    return { ok: false, error: "会議室が不正です" }
  }

  const nameValue = formData.get("name")

  const name = typeof nameValue === "string" ? nameValue : ""

  if (name === "") {
    return { ok: false, error: "名称を入力してください" }
  }

  const capacity = toCapacity(formData.get("capacity"))

  if (capacity === null) {
    return { ok: false, error: "定員は正の整数で入力してください" }
  }

  const locationValue = formData.get("location")

  const location = typeof locationValue === "string" && locationValue !== "" ? locationValue : null

  const updated = await updateRoom(roomId, { name: name, capacity: capacity, location: location })

  if (updated instanceof Error) {
    return { ok: false, error: updated.message }
  }

  revalidatePath("/room/rooms/manage")
  revalidatePath("/room/rooms")

  return { ok: true, error: null }
}

/**
 * 会議室削除の Server Action。id は hidden から受け取る。成功時は一覧へ遷移する。
 * Server Action は直接呼べるため getMe のロールで二重に弾く（defense-in-depth）。
 */
export async function deleteRoomAction(
  previousState: RoomDeleteFormState,
  formData: FormData,
): Promise<RoomDeleteFormState> {
  const me = await getMe()

  if (me instanceof Error || !canManageRooms(me.permissions)) {
    return { ok: false, error: "権限がありません" }
  }

  const roomId = toPositiveIntId(formData.get("id"))

  if (roomId === null) {
    return { ok: false, error: "会議室が不正です" }
  }

  const deleted = await deleteRoom(roomId)

  if (deleted instanceof Error) {
    return { ok: false, error: deleted.message }
  }

  revalidatePath("/room/rooms/manage")
  revalidatePath("/room/rooms")

  // redirect() せず ok:true を返す。クライアント側で遷移を処理し、
  // 成功フィードバック（toast等）が握り潰されるのを防ぐ。
  return { ok: true, error: null }
}
