"use server"

import { revalidatePath } from "next/cache"
import { grantAccountRole } from "@/lib/api/grant-account-role"
import { revokeAccountRole } from "@/lib/api/revoke-account-role"
import { setAccountStatus } from "@/lib/api/set-account-status"

export type GrantRoleFormState = {
  ok: boolean
  error: string | null
}

export type AccountActionFormState = {
  ok: boolean
  error: string | null
}

// アカウントからロールを剥奪する。
export async function revokeAccountRoleAction(
  _prevState: AccountActionFormState,
  formData: FormData,
): Promise<AccountActionFormState> {
  const accountId = toPositiveInt(formData.get("account_id"))

  const roleKey = toText(formData.get("role_key"))

  if (accountId === null || roleKey === null) {
    return { ok: false, error: "アカウントとロールを指定してください" }
  }

  const revoked = await revokeAccountRole(accountId, roleKey)

  if (revoked instanceof Error) {
    return { ok: false, error: "ロールの剥奪に失敗しました（最後の管理者は外せません）" }
  }

  revalidatePath("/admin/accounts")

  return { ok: true, error: null }
}

// アカウントの状態を変更する（停止・有効化）。
export async function setAccountStatusAction(
  _prevState: AccountActionFormState,
  formData: FormData,
): Promise<AccountActionFormState> {
  const accountId = toPositiveInt(formData.get("account_id"))

  const status = toStatus(formData.get("status"))

  if (accountId === null || status === null) {
    return { ok: false, error: "アカウントと状態を指定してください" }
  }

  const updated = await setAccountStatus(accountId, status)

  if (updated instanceof Error) {
    return { ok: false, error: "状態の変更に失敗しました（自分自身は停止できません）" }
  }

  revalidatePath("/admin/accounts")

  return { ok: true, error: null }
}

function toStatus(value: FormDataEntryValue | null): "active" | "suspended" | "locked" | null {
  if (value === "active" || value === "suspended" || value === "locked") {
    return value
  }

  return null
}

// FormData からアカウントへのロール付与を実行するサーバーアクション。
export async function grantAccountRoleAction(
  _prevState: GrantRoleFormState,
  formData: FormData,
): Promise<GrantRoleFormState> {
  const accountId = toPositiveInt(formData.get("account_id"))

  const roleKey = toText(formData.get("role_key"))

  if (accountId === null || roleKey === null) {
    return { ok: false, error: "アカウントとロールを指定してください" }
  }

  const granted = await grantAccountRole(accountId, roleKey)

  if (granted instanceof Error) {
    return { ok: false, error: "ロールの付与に失敗しました（自己付与の禁止や権限不足の可能性）" }
  }

  revalidatePath("/admin/accounts")

  return { ok: true, error: null }
}

function toPositiveInt(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string") {
    return null
  }

  const parsed = Number(value)

  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function toText(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim()

  return trimmed === "" ? null : trimmed
}
