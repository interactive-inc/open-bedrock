"use server"

import { revalidatePath } from "next/cache"
import { ApiResponseError } from "@/lib/api/api-response-error"
import { getMe } from "@/lib/api/get-me"
import { grantAccountRole } from "@/lib/api/grant-account-role"
import { resetAccountPassword } from "@/lib/api/reset-account-password"
import { revokeAccountRole } from "@/lib/api/revoke-account-role"
import { setAccountStatus } from "@/lib/api/set-account-status"
import { canAssignRoles } from "@/lib/iam/can-assign-roles"
import { canManageAccounts } from "@/lib/iam/can-manage-accounts"

export type GrantRoleFormState = {
  ok: boolean
  error: string | null
}

export type AccountActionFormState = {
  ok: boolean
  error: string | null
}

// api の {error, code} 応答の code を、そのアクションの文脈に合った日本語文言へ変換する。
// 同じ code でもアクションによって意味が変わる（last_admin は剥奪では「外せません」、
// 停止では「停止できません」）ため、マップはアクションごとに分ける。
// 未知の code や code の無い応答（ApiResponseError 以外の Error）は fallback を返す。
function toActionErrorMessage(
  error: Error,
  messages: Record<string, string>,
  fallback: string,
): string {
  if (error instanceof ApiResponseError && error.code !== null) {
    const mapped = messages[error.code]

    if (mapped !== undefined) {
      return mapped
    }
  }

  return fallback
}

// アカウントからロールを剥奪する。iam:assign_roles 権限が必要。
export async function revokeAccountRoleAction(
  _prevState: AccountActionFormState,
  formData: FormData,
): Promise<AccountActionFormState> {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canAssignRoles(currentUser.permissions) === false) {
    return { ok: false, error: "ロールを管理する権限がありません" }
  }

  const accountId = toPositiveInt(formData.get("account_id"))

  const roleKey = toText(formData.get("role_key"))

  if (accountId === null || roleKey === null) {
    return { ok: false, error: "アカウントとロールを指定してください" }
  }

  const revoked = await revokeAccountRole(accountId, roleKey)

  if (revoked instanceof Error) {
    const message = toActionErrorMessage(
      revoked,
      {
        last_admin: "最後の管理者はロールを外せません",
        role_escalation: "自分より強い権限のロールは外せません",
        role_not_found: "指定したロールが見つかりません",
        forbidden: "ロールを管理する権限がありません",
      },
      "ロールの剥奪に失敗しました",
    )

    return { ok: false, error: message }
  }

  revalidatePath("/admin/accounts")

  return { ok: true, error: null }
}

// 管理者がアカウントのパスワードを再設定する。account:manage 権限が必要。
export async function resetPasswordAction(
  _prevState: AccountActionFormState,
  formData: FormData,
): Promise<AccountActionFormState> {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canManageAccounts(currentUser.permissions) === false) {
    return { ok: false, error: "アカウントを管理する権限がありません" }
  }

  const accountId = toPositiveInt(formData.get("account_id"))

  const newPassword = toText(formData.get("new_password"))

  if (accountId === null || newPassword === null) {
    return { ok: false, error: "アカウントとパスワードを指定してください" }
  }

  if (newPassword.length < 8) {
    return { ok: false, error: "パスワードは8文字以上にしてください" }
  }

  const reset = await resetAccountPassword(accountId, newPassword)

  if (reset instanceof Error) {
    const message = toActionErrorMessage(
      reset,
      {
        weak_password: "パスワードは8文字以上にしてください",
        role_escalation: "自分より強い権限のアカウントは変更できません",
        account_not_found: "対象のアカウントが見つかりません",
        identity_not_found: "このアカウントにはパスワードが設定されていません",
        forbidden: "アカウントを管理する権限がありません",
      },
      "パスワードの再設定に失敗しました",
    )

    return { ok: false, error: message }
  }

  revalidatePath("/admin/accounts")

  return { ok: true, error: null }
}

// アカウントの状態を変更する（停止・有効化）。account:manage 権限が必要。
export async function setAccountStatusAction(
  _prevState: AccountActionFormState,
  formData: FormData,
): Promise<AccountActionFormState> {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canManageAccounts(currentUser.permissions) === false) {
    return { ok: false, error: "アカウントを管理する権限がありません" }
  }

  const accountId = toPositiveInt(formData.get("account_id"))

  const status = toStatus(formData.get("status"))

  if (accountId === null || status === null) {
    return { ok: false, error: "アカウントと状態を指定してください" }
  }

  const updated = await setAccountStatus(accountId, status)

  if (updated instanceof Error) {
    const message = toActionErrorMessage(
      updated,
      {
        self_deactivation: "自分自身は停止できません",
        last_admin: "最後の管理者は停止できません",
        role_escalation: "自分より強い権限のアカウントは変更できません",
        account_not_found: "対象のアカウントが見つかりません",
        invalid_status: "指定した状態が不正です",
        forbidden: "アカウントを管理する権限がありません",
      },
      "状態の変更に失敗しました",
    )

    return { ok: false, error: message }
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

// FormData からアカウントへのロール付与を実行するサーバーアクション。iam:assign_roles 権限が必要。
export async function grantAccountRoleAction(
  _prevState: GrantRoleFormState,
  formData: FormData,
): Promise<GrantRoleFormState> {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canAssignRoles(currentUser.permissions) === false) {
    return { ok: false, error: "ロールを管理する権限がありません" }
  }

  const accountId = toPositiveInt(formData.get("account_id"))

  const roleKey = toText(formData.get("role_key"))

  if (accountId === null || roleKey === null) {
    return { ok: false, error: "アカウントとロールを指定してください" }
  }

  const granted = await grantAccountRole(accountId, roleKey)

  if (granted instanceof Error) {
    const message = toActionErrorMessage(
      granted,
      {
        self_assignment: "自分自身にはロールを付与できません",
        role_escalation: "自分が持たない権限を含むロールは付与できません",
        role_not_found: "指定したロールが見つかりません",
        account_not_found: "対象のアカウントが見つかりません",
        forbidden: "ロールを管理する権限がありません",
      },
      "ロールの付与に失敗しました",
    )

    return { ok: false, error: message }
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
