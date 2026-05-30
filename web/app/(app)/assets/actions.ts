"use server"

import { revalidatePath } from "next/cache"
import { createAsset } from "@/lib/api/create-asset"
import { lendAsset } from "@/lib/api/lend-asset"
import { returnAsset } from "@/lib/api/return-asset"
import type { AssetKind } from "@/lib/api/types/asset-types"

export type AssetCreateFormState = {
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
