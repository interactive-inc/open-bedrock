"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createRole } from "@/lib/api/create-role"

export type RoleCreateFormState = {
  ok: boolean
  error: string | null
}

// FormData からロール作成を実行するサーバーアクション。
// permission_keys は同名の複数チェックボックスから配列で受け取る。
export async function createRoleAction(
  _prevState: RoleCreateFormState,
  formData: FormData,
): Promise<RoleCreateFormState> {
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

  redirect("/admin/roles")
}

// 空文字・非文字列を null に潰した文字列を返す。
function toText(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim()

  return trimmed === "" ? null : trimmed
}
