"use server"

import { revalidatePath } from "next/cache"
import { createAsset } from "@/lib/api/create-asset"
import { deleteAsset } from "@/lib/api/delete-asset"
import { disposeAsset } from "@/lib/api/dispose-asset"
import { getMe } from "@/lib/api/get-me"
import { lendAsset } from "@/lib/api/lend-asset"
import { returnAsset } from "@/lib/api/return-asset"
import { updateAsset } from "@/lib/api/update-asset"
import type { AssetKind } from "@/lib/api/types/asset-types"
import { canManageAssets } from "@/lib/asset/can-manage-assets"

export type AssetCreateFormState = {
  ok: boolean
  error: string | null
}

export type AssetUpdateFormState = {
  ok: boolean
  error: string | null
}

export type AssetDeleteFormState = {
  ok: boolean
  error: string | null
}

export type AssetLendFormState = {
  ok: boolean
  error: string | null
}

export type AssetReturnFormState = {
  ok: boolean
  error: string | null
}

export type AssetDisposeFormState = {
  ok: boolean
  error: string | null
}

const assetKinds: ReadonlyArray<AssetKind> = ["pc", "monitor", "furniture", "other"]

/** FormData の文字列を種別 enum へ検証付きで変換する。不正なら null。 */
function toKind(value: FormDataEntryValue | null): AssetKind | null {
  if (typeof value !== "string") {
    return null
  }

  for (const kind of assetKinds) {
    if (kind === value) {
      return kind
    }
  }

  return null
}

/** 物品登録の Server Action。serial / purchased_on の空文字は値なし扱いで送らない。 */
export async function createAssetAction(
  previousState: AssetCreateFormState,
  formData: FormData,
): Promise<AssetCreateFormState> {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canManageAssets(currentUser.permissions) === false) {
    return { ok: false, error: "資産を管理する権限がありません" }
  }

  const codeValue = formData.get("code")

  const code = typeof codeValue === "string" ? codeValue : ""

  if (code === "") {
    return { ok: false, error: "資産コードを入力してください" }
  }

  const nameValue = formData.get("name")

  const name = typeof nameValue === "string" ? nameValue : ""

  if (name === "") {
    return { ok: false, error: "名称を入力してください" }
  }

  const kind = toKind(formData.get("kind"))

  if (kind === null) {
    return { ok: false, error: "種別を選択してください" }
  }

  const serialValue = formData.get("serial")

  const serial = typeof serialValue === "string" && serialValue !== "" ? serialValue : undefined

  const purchasedOnValue = formData.get("purchased_on")

  const purchasedOn =
    typeof purchasedOnValue === "string" && purchasedOnValue !== "" ? purchasedOnValue : undefined

  const created = await createAsset({
    code: code,
    name: name,
    kind: kind,
    serial: serial,
    purchased_on: purchasedOn,
  })

  if (created instanceof Error) {
    return { ok: false, error: created.message }
  }

  revalidatePath("/asset/assets")

  return { ok: true, error: null }
}

/** 物品貸与の Server Action。code は hidden、貸与先の従業員コードを受け取る。 */
export async function lendAssetAction(
  previousState: AssetLendFormState,
  formData: FormData,
): Promise<AssetLendFormState> {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canManageAssets(currentUser.permissions) === false) {
    return { ok: false, error: "資産を管理する権限がありません" }
  }

  const codeValue = formData.get("code")

  const code = typeof codeValue === "string" ? codeValue : ""

  if (code === "") {
    return { ok: false, error: "資産が不正です" }
  }

  const employeeCodeValue = formData.get("employee_code")

  const employeeCode = typeof employeeCodeValue === "string" ? employeeCodeValue : ""

  if (employeeCode === "") {
    return { ok: false, error: "従業員コードを入力してください" }
  }

  const lent = await lendAsset(code, employeeCode)

  if (lent instanceof Error) {
    return { ok: false, error: lent.message }
  }

  revalidatePath("/asset/assets")

  revalidatePath(`/asset/assets/${code}`)

  revalidatePath("/my/assets")

  return { ok: true, error: null }
}

/** 物品返却の Server Action。code は hidden から受け取る。 */
export async function returnAssetAction(
  previousState: AssetReturnFormState,
  formData: FormData,
): Promise<AssetReturnFormState> {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canManageAssets(currentUser.permissions) === false) {
    return { ok: false, error: "資産を管理する権限がありません" }
  }

  const codeValue = formData.get("code")

  const code = typeof codeValue === "string" ? codeValue : ""

  if (code === "") {
    return { ok: false, error: "資産が不正です" }
  }

  const returned = await returnAsset(code)

  if (returned instanceof Error) {
    return { ok: false, error: returned.message }
  }

  revalidatePath("/asset/assets")

  revalidatePath(`/asset/assets/${code}`)

  revalidatePath("/my/assets")

  return { ok: true, error: null }
}

/** 物品廃棄の Server Action。code は hidden、廃棄理由と任意の廃棄日を受け取る。 */
export async function disposeAssetAction(
  previousState: AssetDisposeFormState,
  formData: FormData,
): Promise<AssetDisposeFormState> {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canManageAssets(currentUser.permissions) === false) {
    return { ok: false, error: "資産を管理する権限がありません" }
  }

  const codeValue = formData.get("code")

  const code = typeof codeValue === "string" ? codeValue : ""

  if (code === "") {
    return { ok: false, error: "資産が不正です" }
  }

  const reasonValue = formData.get("reason")

  const reason = typeof reasonValue === "string" ? reasonValue : ""

  if (reason === "") {
    return { ok: false, error: "廃棄理由を入力してください" }
  }

  const disposedOnValue = formData.get("disposed_on")

  const disposedOn =
    typeof disposedOnValue === "string" && disposedOnValue !== "" ? disposedOnValue : undefined

  const disposed = await disposeAsset(code, reason, disposedOn)

  if (disposed instanceof Error) {
    return { ok: false, error: disposed.message }
  }

  revalidatePath("/asset/assets")

  revalidatePath(`/asset/assets/${code}`)

  return { ok: true, error: null }
}

/**
 * 物品編集の Server Action。code は hidden、名称・種別・シリアル・購入日を更新する。
 * serial / purchased_on の空文字は値なし扱いで送らない。
 */
export async function updateAssetAction(
  previousState: AssetUpdateFormState,
  formData: FormData,
): Promise<AssetUpdateFormState> {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canManageAssets(currentUser.permissions) === false) {
    return { ok: false, error: "資産を管理する権限がありません" }
  }

  const codeValue = formData.get("code")

  const code = typeof codeValue === "string" ? codeValue : ""

  if (code === "") {
    return { ok: false, error: "資産が不正です" }
  }

  const nameValue = formData.get("name")

  const name = typeof nameValue === "string" ? nameValue : ""

  if (name === "") {
    return { ok: false, error: "名称を入力してください" }
  }

  const kind = toKind(formData.get("kind"))

  if (kind === null) {
    return { ok: false, error: "種別を選択してください" }
  }

  const serialValue = formData.get("serial")

  const serial = typeof serialValue === "string" && serialValue !== "" ? serialValue : undefined

  const purchasedOnValue = formData.get("purchased_on")

  const purchasedOn =
    typeof purchasedOnValue === "string" && purchasedOnValue !== "" ? purchasedOnValue : undefined

  const updated = await updateAsset(code, {
    name: name,
    kind: kind,
    serial: serial,
    purchased_on: purchasedOn,
  })

  if (updated instanceof Error) {
    return { ok: false, error: updated.message }
  }

  revalidatePath("/asset/assets")

  revalidatePath(`/asset/assets/${code}`)

  return { ok: true, error: null }
}

/** 物品削除の Server Action。code は hidden から受け取る。成功時は一覧へ遷移する。 */
export async function deleteAssetAction(
  previousState: AssetDeleteFormState,
  formData: FormData,
): Promise<AssetDeleteFormState> {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canManageAssets(currentUser.permissions) === false) {
    return { ok: false, error: "資産を管理する権限がありません" }
  }

  const codeValue = formData.get("code")

  const code = typeof codeValue === "string" ? codeValue : ""

  if (code === "") {
    return { ok: false, error: "資産が不正です" }
  }

  const deleted = await deleteAsset(code)

  if (deleted instanceof Error) {
    return { ok: false, error: deleted.message }
  }

  revalidatePath("/asset/assets")

  // redirect() せず ok:true を返す。クライアント側で遷移を処理し、
  // 成功フィードバック（toast等）が握り潰されるのを防ぐ。
  return { ok: true, error: null }
}
