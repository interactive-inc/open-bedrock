"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createAsset } from "@/lib/api/create-asset"
import { deleteAsset } from "@/lib/api/delete-asset"
import { lendAsset } from "@/lib/api/lend-asset"
import { returnAsset } from "@/lib/api/return-asset"
import { updateAsset } from "@/lib/api/update-asset"
import type { AssetKind } from "@/lib/api/types/asset-types"

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

const assetKinds: ReadonlyArray<AssetKind> = ["pc", "monitor", "furniture", "other"]

// FormData の文字列を種別 enum へ検証付きで変換する。不正なら null。
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

// 物品登録の Server Action。serial / purchased_on の空文字は値なし扱いで送らない。
export async function createAssetAction(
  previousState: AssetCreateFormState,
  formData: FormData,
): Promise<AssetCreateFormState> {
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
    return { ok: false, error: "物品の登録に失敗しました" }
  }

  revalidatePath("/assets")

  return { ok: true, error: null }
}

// 物品貸与の Server Action。code は hidden、貸与先の従業員コードを受け取る。
export async function lendAssetAction(
  previousState: AssetLendFormState,
  formData: FormData,
): Promise<AssetLendFormState> {
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
    return { ok: false, error: "貸与に失敗しました" }
  }

  revalidatePath("/assets")

  revalidatePath(`/assets/${code}`)

  return { ok: true, error: null }
}

// 物品返却の Server Action。code は hidden から受け取る。
export async function returnAssetAction(
  previousState: AssetReturnFormState,
  formData: FormData,
): Promise<AssetReturnFormState> {
  const codeValue = formData.get("code")

  const code = typeof codeValue === "string" ? codeValue : ""

  if (code === "") {
    return { ok: false, error: "資産が不正です" }
  }

  const returned = await returnAsset(code)

  if (returned instanceof Error) {
    return { ok: false, error: "返却に失敗しました" }
  }

  revalidatePath("/assets")

  revalidatePath(`/assets/${code}`)

  revalidatePath("/assets/lent/me")

  return { ok: true, error: null }
}

// 物品編集の Server Action。code は hidden、名称・種別・シリアル・購入日を更新する。
// serial / purchased_on の空文字は値なし扱いで送らない。
export async function updateAssetAction(
  previousState: AssetUpdateFormState,
  formData: FormData,
): Promise<AssetUpdateFormState> {
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
    return { ok: false, error: "物品の更新に失敗しました" }
  }

  revalidatePath("/assets")

  revalidatePath(`/assets/${code}`)

  return { ok: true, error: null }
}

// 物品削除の Server Action。code は hidden から受け取る。成功時は一覧へ遷移する。
export async function deleteAssetAction(
  previousState: AssetDeleteFormState,
  formData: FormData,
): Promise<AssetDeleteFormState> {
  const codeValue = formData.get("code")

  const code = typeof codeValue === "string" ? codeValue : ""

  if (code === "") {
    return { ok: false, error: "資産が不正です" }
  }

  const deleted = await deleteAsset(code)

  if (deleted instanceof Error) {
    return { ok: false, error: "物品の削除に失敗しました（貸与中は削除できません）" }
  }

  revalidatePath("/assets")

  // 削除後は詳細ページが消えるため一覧へ遷移する。redirect は内部で throw するので最後に呼ぶ。
  redirect("/assets")
}
