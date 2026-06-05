"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createRoom } from "@/lib/api/create-room"
import { deleteRoom } from "@/lib/api/delete-room"
import { updateRoom } from "@/lib/api/update-room"
import { toPositiveIntId } from "@/lib/form/to-positive-int-id"

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

// FormData の文字列を正の整数へ検証付きで変換する。不正なら null。
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

// 会議室登録の Server Action。location の空文字は値なし扱いにする。
export async function createRoomAction(
  previousState: RoomCreateFormState,
  formData: FormData,
): Promise<RoomCreateFormState> {
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
    return { ok: false, error: "会議室の登録に失敗しました" }
  }

  revalidatePath("/rooms/manage")

  return { ok: true, error: null }
}

// 会議室編集の Server Action。id は hidden、名称・定員・所在地を更新する。
export async function updateRoomAction(
  previousState: RoomUpdateFormState,
  formData: FormData,
): Promise<RoomUpdateFormState> {
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
    return { ok: false, error: "会議室の更新に失敗しました" }
  }

  revalidatePath("/rooms/manage")

  return { ok: true, error: null }
}

// 会議室削除の Server Action。id は hidden から受け取る。成功時は一覧へ遷移する。
export async function deleteRoomAction(
  previousState: RoomDeleteFormState,
  formData: FormData,
): Promise<RoomDeleteFormState> {
  const roomId = toPositiveIntId(formData.get("id"))

  if (roomId === null) {
    return { ok: false, error: "会議室が不正です" }
  }

  const deleted = await deleteRoom(roomId)

  if (deleted instanceof Error) {
    return { ok: false, error: "会議室の削除に失敗しました" }
  }

  revalidatePath("/rooms/manage")

  // 削除後は一覧へ遷移する。redirect は内部で throw するので最後に呼ぶ。
  redirect("/rooms/manage")
}
