"use server"

import { revalidatePath } from "next/cache"
import { createRole } from "@/lib/api/create-role"
import { deleteRole } from "@/lib/api/delete-role"
import { getMe } from "@/lib/api/get-me"
import { updateRole } from "@/lib/api/update-role"
import { canManageRoles } from "@/lib/iam/can-manage-roles"

export type RoleCreateFormState = {
  ok: boolean
  error: string | null
}

export type RoleUpdateFormState = {
  ok: boolean
  error: string | null
}

// FormData からロール更新を実行するサーバーアクション。iam:manage_roles 権限が必要。
export async function updateRoleAction(
  _prevState: RoleUpdateFormState,
  formData: FormData,
): Promise<RoleUpdateFormState> {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canManageRoles(currentUser.permissions) === false) {
    return { ok: false, error: "ロールを管理する権限がありません" }
  }

  const roleId = toRoleId(formData.get("role_id"))

  const name = toRoleText(formData.get("name"))

  if (roleId === null || name === null) {
    return { ok: false, error: "ロールと名前は必須です" }
  }

  const description = toRoleText(formData.get("description"))

  const permissionKeys = formData
    .getAll("permission_keys")
    .filter((value): value is string => typeof value === "string")

  const updated = await updateRole(roleId, {
    name: name,
    description: description,
    permissionKeys: permissionKeys,
  })

  if (updated instanceof Error) {
    return { ok: false, error: "ロールの更新に失敗しました（権限不足の可能性）" }
  }

  revalidatePath("/admin/roles")

  // redirect() せず ok:true を返す。クライアント側で遷移を処理し、
  // 成功フィードバック（toast等）が握り潰されるのを防ぐ。
  return { ok: true, error: null }
}

function toRoleId(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string") {
    return null
  }

  const parsed = Number(value)

  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function toRoleText(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim()

  return trimmed === "" ? null : trimmed
}

export type RoleDeleteFormState = {
  ok: boolean
  error: string | null
}

// 動的ロールを削除する。iam:manage_roles 権限が必要。
export async function deleteRoleAction(
  _prevState: RoleDeleteFormState,
  formData: FormData,
): Promise<RoleDeleteFormState> {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canManageRoles(currentUser.permissions) === false) {
    return { ok: false, error: "ロールを管理する権限がありません" }
  }

  const roleId = toPositiveInt(formData.get("role_id"))

  if (roleId === null) {
    return { ok: false, error: "ロールを指定してください" }
  }

  const deleted = await deleteRole(roleId)

  if (deleted instanceof Error) {
    return { ok: false, error: "削除に失敗しました（システムロールや割当中は削除できません）" }
  }

  revalidatePath("/admin/roles")

  return { ok: true, error: null }
}

function toPositiveInt(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string") {
    return null
  }

  const parsed = Number(value)

  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

// FormData からロール作成を実行するサーバーアクション。iam:manage_roles 権限が必要。
// permission_keys は同名の複数チェックボックスから配列で受け取る。
export async function createRoleAction(
  _prevState: RoleCreateFormState,
  formData: FormData,
): Promise<RoleCreateFormState> {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canManageRoles(currentUser.permissions) === false) {
    return { ok: false, error: "ロールを管理する権限がありません" }
  }

  const key = toText(formData.get("key"))

  const name = toText(formData.get("name"))

  if (key === null || name === null) {
    return { ok: false, error: "キーと名前は必須です" }
  }

  const description = toText(formData.get("description"))

  const permissionKeys = formData
    .getAll("permission_keys")
    .filter((value): value is string => typeof value === "string")

  const created = await createRole({
    key: key,
    name: name,
    description: description,
    permissionKeys: permissionKeys,
  })

  if (created instanceof Error) {
    return { ok: false, error: "ロールの作成に失敗しました（キー重複や権限不足の可能性）" }
  }

  revalidatePath("/admin/roles")

  // redirect() せず ok:true を返す。クライアント側で遷移を処理し、
  // 成功フィードバック（toast等）が握り潰されるのを防ぐ。
  return { ok: true, error: null }
}

// 空文字・非文字列を null に潰した文字列を返す。
function toText(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim()

  return trimmed === "" ? null : trimmed
}
