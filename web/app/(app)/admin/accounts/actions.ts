"use server"

import { revalidatePath } from "next/cache"
import { grantAccountRole } from "@/lib/api/grant-account-role"

export type GrantRoleFormState = {
  ok: boolean
  error: string | null
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
