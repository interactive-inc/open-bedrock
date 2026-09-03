"use server"

import { revalidatePath } from "next/cache"
import { createOrgDepartment } from "@/lib/api/create-org-department"
import { deleteOrgDepartment } from "@/lib/api/delete-org-department"
import { getMe } from "@/lib/api/get-me"
import { updateOrgDepartment } from "@/lib/api/update-org-department"
import { canManageOrg } from "@/lib/org/can-manage-org"

/** useActionState で参照する共通の戻り値。ok=成功 / error=表示するエラー文言。 */
export type OrgDepartmentActionState = {
  ok: boolean
  error: string | null
}

/**
 * 組織単位作成 Server Action。code/name 必須、parent は任意。
 * 権限不足やコード重複は api がエラーを返す。成功時は一覧へ redirect する。
 */
export async function createOrgDepartmentAction(
  previousState: OrgDepartmentActionState,
  formData: FormData,
): Promise<OrgDepartmentActionState> {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canManageOrg(currentUser.permissions) === false) {
    return { ok: false, error: "組織を管理する権限がありません" }
  }

  const code = toText(formData.get("code"))

  if (code === null) {
    return { ok: false, error: "部署コードを入力してください" }
  }

  const name = toText(formData.get("name"))
  if (name === null) {
    return { ok: false, error: "部署名を入力してください" }
  }

  const created = await createOrgDepartment({
    code: code,
    name,
    parent_code: toText(formData.get("parent_code")),
  })

  if (created instanceof Error) {
    return { ok: false, error: created.message }
  }

  revalidatePath("/company/departments")

  revalidatePath("/company/departments")

  // redirect() せず ok:true を返す。クライアント側で遷移を処理し、
  // 成功フィードバック（toast等）が握り潰されるのを防ぐ。
  return { ok: true, error: null }
}

/**
 * 組織単位変更 Server Action。code/name 必須、parent は任意。
 * 権限不足・不存在・自身を親にする変更は api がエラーを返す。成功時は /org を revalidate する。
 */
export async function updateOrgDepartmentAction(
  previousState: OrgDepartmentActionState,
  formData: FormData,
): Promise<OrgDepartmentActionState> {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canManageOrg(currentUser.permissions) === false) {
    return { ok: false, error: "組織を管理する権限がありません" }
  }

  const code = toText(formData.get("code"))

  if (code === null) {
    return { ok: false, error: "部署を特定できませんでした" }
  }

  const name = toText(formData.get("name"))
  if (name === null) {
    return { ok: false, error: "部署名を入力してください" }
  }

  const updated = await updateOrgDepartment(code, {
    name,
    parent_code: toText(formData.get("parent_code")),
  })

  if (updated instanceof Error) {
    return { ok: false, error: updated.message }
  }

  revalidatePath("/company/departments")

  return { ok: true, error: null }
}

/** 部署ノード削除 Server Action。code 必須。成功時は /org を revalidate する。 */
export async function deleteOrgDepartmentAction(
  previousState: OrgDepartmentActionState,
  formData: FormData,
): Promise<OrgDepartmentActionState> {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canManageOrg(currentUser.permissions) === false) {
    return { ok: false, error: "組織を管理する権限がありません" }
  }

  const code = toText(formData.get("code"))

  if (code === null) {
    return { ok: false, error: "部署を特定できませんでした" }
  }

  const deleted = await deleteOrgDepartment(code)

  if (deleted instanceof Error) {
    return { ok: false, error: deleted.message }
  }

  revalidatePath("/company/departments")

  return { ok: true, error: null }
}

/** FormData 値を文字列へ。未入力や空白のみは null。 */
function toText(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string" || value.trim() === "") {
    return null
  }

  return value.trim()
}
