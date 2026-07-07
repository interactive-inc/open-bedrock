"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createPartner } from "@/lib/api/create-partner"
import { updatePartner } from "@/lib/api/update-partner"
import { archivePartner } from "@/lib/api/archive-partner"
import { createContract } from "@/lib/api/create-contract"
import { updateContract } from "@/lib/api/update-contract"
import { getMe } from "@/lib/api/get-me"
import type { PartnerCategory } from "@/lib/api/types/partner-types"
import { canManagePartners } from "@/lib/partner/can-manage-partners"
import { canManageContracts } from "@/lib/contract/can-manage-contracts"

export type PartnerCreateFormState = {
  ok: boolean
  error: string | null
}

export type PartnerUpdateFormState = {
  ok: boolean
  error: string | null
}

export type PartnerArchiveFormState = {
  ok: boolean
  error: string | null
}

export type ContractCreateFormState = {
  ok: boolean
  error: string | null
}

export type ContractUpdateFormState = {
  ok: boolean
  error: string | null
}

const partnerCategories: ReadonlyArray<PartnerCategory> = ["customer", "supplier", "other"]

// FormData の文字列を分類 enum へ検証付きで変換する。空文字・不正なら null。
function toCategory(value: FormDataEntryValue | null): PartnerCategory | null {
  if (typeof value !== "string") {
    return null
  }

  for (const category of partnerCategories) {
    if (category === value) {
      return category
    }
  }

  return null
}

// FormData の文字列を取り出す。文字列でなければ空文字。
function toStringValue(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : ""
}

// FormData の任意文字列を取り出す。空文字は値なし扱いで undefined。
function toOptionalString(value: FormDataEntryValue | null): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined
}

// 取引先登録の Server Action。category / corporate_number / note の空文字は送らない。
export async function createPartnerAction(
  previousState: PartnerCreateFormState,
  formData: FormData,
): Promise<PartnerCreateFormState> {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canManagePartners(currentUser.permissions) === false) {
    return { ok: false, error: "取引先を管理する権限がありません" }
  }

  const code = toStringValue(formData.get("code"))

  if (code === "") {
    return { ok: false, error: "取引先コードを入力してください" }
  }

  const name = toStringValue(formData.get("name"))

  if (name === "") {
    return { ok: false, error: "名称を入力してください" }
  }

  const created = await createPartner({
    code: code,
    name: name,
    category: toCategory(formData.get("category")) ?? undefined,
    corporate_number: toOptionalString(formData.get("corporate_number")),
    note: toOptionalString(formData.get("note")),
  })

  if (created instanceof Error) {
    return { ok: false, error: created.message }
  }

  revalidatePath("/partners")

  return { ok: true, error: null }
}

// 取引先編集の Server Action。id は hidden、名称・分類・法人番号・備考を更新する。
export async function updatePartnerAction(
  previousState: PartnerUpdateFormState,
  formData: FormData,
): Promise<PartnerUpdateFormState> {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canManagePartners(currentUser.permissions) === false) {
    return { ok: false, error: "取引先を管理する権限がありません" }
  }

  const id = Number(toStringValue(formData.get("id")))

  if (Number.isInteger(id) === false || id <= 0) {
    return { ok: false, error: "取引先が不正です" }
  }

  const code = toStringValue(formData.get("code"))

  const name = toStringValue(formData.get("name"))

  if (name === "") {
    return { ok: false, error: "名称を入力してください" }
  }

  const updated = await updatePartner(id, {
    name: name,
    category: toCategory(formData.get("category")) ?? undefined,
    corporate_number: toOptionalString(formData.get("corporate_number")),
    note: toOptionalString(formData.get("note")),
  })

  if (updated instanceof Error) {
    return { ok: false, error: updated.message }
  }

  revalidatePath("/partners")

  if (code !== "") {
    revalidatePath(`/partners/${code}`)
  }

  return { ok: true, error: null }
}

// 取引先アーカイブの Server Action。id は hidden から受け取る。成功時は一覧へ遷移する。
export async function archivePartnerAction(
  previousState: PartnerArchiveFormState,
  formData: FormData,
): Promise<PartnerArchiveFormState> {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canManagePartners(currentUser.permissions) === false) {
    return { ok: false, error: "取引先を管理する権限がありません" }
  }

  const id = Number(toStringValue(formData.get("id")))

  if (Number.isInteger(id) === false || id <= 0) {
    return { ok: false, error: "取引先が不正です" }
  }

  const archived = await archivePartner(id)

  if (archived instanceof Error) {
    return { ok: false, error: archived.message }
  }

  revalidatePath("/partners")

  redirect("/partners")
}

// 契約記録作成の Server Action。partner_id と code は hidden。任意日付は空文字を送らない。
export async function createContractAction(
  previousState: ContractCreateFormState,
  formData: FormData,
): Promise<ContractCreateFormState> {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canManageContracts(currentUser.permissions) === false) {
    return { ok: false, error: "契約記録を管理する権限がありません" }
  }

  const partnerId = Number(toStringValue(formData.get("partner_id")))

  if (Number.isInteger(partnerId) === false || partnerId <= 0) {
    return { ok: false, error: "取引先が不正です" }
  }

  const title = toStringValue(formData.get("title"))

  if (title === "") {
    return { ok: false, error: "契約名を入力してください" }
  }

  const contractDate = toStringValue(formData.get("contract_date"))

  if (contractDate === "") {
    return { ok: false, error: "契約日を入力してください" }
  }

  const created = await createContract({
    partner_id: partnerId,
    title: title,
    contract_date: contractDate,
    starts_on: toOptionalString(formData.get("starts_on")),
    ends_on: toOptionalString(formData.get("ends_on")),
    renewal_deadline: toOptionalString(formData.get("renewal_deadline")),
    note: toOptionalString(formData.get("note")),
  })

  if (created instanceof Error) {
    return { ok: false, error: created.message }
  }

  const code = toStringValue(formData.get("code"))

  if (code !== "") {
    revalidatePath(`/partners/${code}`)
  }

  return { ok: true, error: null }
}

// 契約記録編集の Server Action。id・code は hidden。任意日付は空文字を送らない。
export async function updateContractAction(
  previousState: ContractUpdateFormState,
  formData: FormData,
): Promise<ContractUpdateFormState> {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canManageContracts(currentUser.permissions) === false) {
    return { ok: false, error: "契約記録を管理する権限がありません" }
  }

  const id = Number(toStringValue(formData.get("id")))

  if (Number.isInteger(id) === false || id <= 0) {
    return { ok: false, error: "契約記録が不正です" }
  }

  const title = toStringValue(formData.get("title"))

  if (title === "") {
    return { ok: false, error: "契約名を入力してください" }
  }

  const contractDate = toStringValue(formData.get("contract_date"))

  if (contractDate === "") {
    return { ok: false, error: "契約日を入力してください" }
  }

  const updated = await updateContract(id, {
    title: title,
    contract_date: contractDate,
    starts_on: toOptionalString(formData.get("starts_on")),
    ends_on: toOptionalString(formData.get("ends_on")),
    renewal_deadline: toOptionalString(formData.get("renewal_deadline")),
    note: toOptionalString(formData.get("note")),
  })

  if (updated instanceof Error) {
    return { ok: false, error: updated.message }
  }

  const code = toStringValue(formData.get("code"))

  if (code !== "") {
    revalidatePath(`/partners/${code}`)
  }

  return { ok: true, error: null }
}
