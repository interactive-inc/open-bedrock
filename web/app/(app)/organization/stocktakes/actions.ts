"use server"

import { revalidatePath } from "next/cache"
import { checkStocktakeItem } from "@/lib/api/check-stocktake-item"
import { closeStocktake } from "@/lib/api/close-stocktake"
import { getMe } from "@/lib/api/get-me"
import { startStocktake } from "@/lib/api/start-stocktake"
import { canManageAssets } from "@/lib/asset/can-manage-assets"

export type StocktakeStartFormState = {
  ok: boolean
  error: string | null
  // 開始に成功した棚卸しの id。クライアント側で詳細ページへ遷移するために使う。
  id: string | null
}

export type StocktakeCheckFormState = {
  ok: boolean
  error: string | null
}

export type StocktakeCloseFormState = {
  ok: boolean
  error: string | null
}

// 棚卸し開始の Server Action。名称と対象日を受け取り、成功時は詳細ページへ遷移する。
export async function startStocktakeAction(
  previousState: StocktakeStartFormState,
  formData: FormData,
): Promise<StocktakeStartFormState> {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canManageAssets(currentUser.permissions) === false) {
    return { ok: false, error: "棚卸しを管理する権限がありません", id: null }
  }

  const nameValue = formData.get("name")

  const name = typeof nameValue === "string" ? nameValue : ""

  if (name === "") {
    return { ok: false, error: "名称を入力してください", id: null }
  }

  const targetDateValue = formData.get("target_date")

  const targetDate = typeof targetDateValue === "string" ? targetDateValue : ""

  if (targetDate === "") {
    return { ok: false, error: "対象日を入力してください", id: null }
  }

  const started = await startStocktake(name, targetDate)

  if (started instanceof Error) {
    return { ok: false, error: started.message, id: null }
  }

  revalidatePath("/organization/stocktakes")

  // redirect() せず ok:true を返す。クライアント側で遷移を処理し、
  // 成功フィードバック（toast等）が握り潰されるのを防ぐ。
  return { ok: true, error: null, id: started.id }
}

// 現物確認の Server Action。id と資産コードと任意の所在メモを受け取る。
export async function checkStocktakeItemAction(
  previousState: StocktakeCheckFormState,
  formData: FormData,
): Promise<StocktakeCheckFormState> {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canManageAssets(currentUser.permissions) === false) {
    return { ok: false, error: "棚卸しを管理する権限がありません" }
  }

  const idValue = formData.get("id")

  const id = typeof idValue === "string" ? idValue : ""

  const assetCodeValue = formData.get("asset_code")

  const assetCode = typeof assetCodeValue === "string" ? assetCodeValue : ""

  if (id === "" || assetCode === "") {
    return { ok: false, error: "棚卸しまたは資産が不正です" }
  }

  const locationNoteValue = formData.get("location_note")

  const locationNote =
    typeof locationNoteValue === "string" && locationNoteValue !== ""
      ? locationNoteValue
      : undefined

  const checked = await checkStocktakeItem(id, assetCode, locationNote)

  if (checked instanceof Error) {
    return { ok: false, error: checked.message }
  }

  revalidatePath(`/organization/stocktakes/${id}`)

  return { ok: true, error: null }
}

// 棚卸し締めの Server Action。id を受け取りセッションを締める。
export async function closeStocktakeAction(
  previousState: StocktakeCloseFormState,
  formData: FormData,
): Promise<StocktakeCloseFormState> {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canManageAssets(currentUser.permissions) === false) {
    return { ok: false, error: "棚卸しを管理する権限がありません" }
  }

  const idValue = formData.get("id")

  const id = typeof idValue === "string" ? idValue : ""

  if (id === "") {
    return { ok: false, error: "棚卸しが不正です" }
  }

  const closed = await closeStocktake(id)

  if (closed instanceof Error) {
    return { ok: false, error: closed.message }
  }

  revalidatePath("/organization/stocktakes")

  revalidatePath(`/organization/stocktakes/${id}`)

  return { ok: true, error: null }
}
