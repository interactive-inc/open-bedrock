"use server"

import { revalidatePath } from "next/cache"
import { createOrgDepartment } from "@/lib/api/create-org-department"
import { deleteOrgDepartment } from "@/lib/api/delete-org-department"
import { updateOrgDepartment } from "@/lib/api/update-org-department"
import { toPositiveIntId } from "@/lib/form/to-positive-int-id"

// useActionState で参照する共通の戻り値。ok=成功 / error=表示するエラー文言。
export type OrgDepartmentActionState = {
  ok: boolean
  error: string | null
}

// 部署ノード作成 Server Action。code/department_id/order 必須、parent/manager は任意。
// 権限不足やコード重複は api がエラーを返す。成功時は /org を revalidate する。
export async function createOrgDepartmentAction(
  previousState: OrgDepartmentActionState,
  formData: FormData,
): Promise<OrgDepartmentActionState> {
  const code = toText(formData.get("code"))

  if (code === null) {
    return { ok: false, error: "部署コードを入力してください" }
  }

  const departmentId = toPositiveIntId(formData.get("department_id"))

  if (departmentId === null) {
    return { ok: false, error: "部署マスタ ID を入力してください" }
  }

  const order = toNumber(formData.get("order"))

  if (order === null) {
    return { ok: false, error: "表示順を入力してください" }
  }

  const created = await createOrgDepartment({
    code: code,
    department_id: departmentId,
    parent_code: toText(formData.get("parent_code")),
    manager_employee_code: toText(formData.get("manager_employee_code")),
    order: order,
  })

  if (created instanceof Error) {
    return {
      ok: false,
      error: "部署の作成に失敗しました（権限またはコード重複の可能性があります）",
    }
  }

  revalidatePath("/org")

  return { ok: true, error: null }
}

// 部署ノード変更 Server Action。code/order 必須、parent/manager は任意。
// 権限不足・不存在・自身を親にする変更は api がエラーを返す。成功時は /org を revalidate する。
export async function updateOrgDepartmentAction(
  previousState: OrgDepartmentActionState,
  formData: FormData,
): Promise<OrgDepartmentActionState> {
  const code = toText(formData.get("code"))

  if (code === null) {
    return { ok: false, error: "部署を特定できませんでした" }
  }

  const order = toNumber(formData.get("order"))

  if (order === null) {
    return { ok: false, error: "表示順を入力してください" }
  }

  const updated = await updateOrgDepartment(code, {
    parent_code: toText(formData.get("parent_code")),
    manager_employee_code: toText(formData.get("manager_employee_code")),
    order: order,
  })

  if (updated instanceof Error) {
    return { ok: false, error: "部署の変更に失敗しました（権限または親指定の可能性があります）" }
  }

  revalidatePath("/org")

  return { ok: true, error: null }
}

// 部署ノード削除 Server Action。code 必須。成功時は /org を revalidate する。
export async function deleteOrgDepartmentAction(
  previousState: OrgDepartmentActionState,
  formData: FormData,
): Promise<OrgDepartmentActionState> {
  const code = toText(formData.get("code"))

  if (code === null) {
    return { ok: false, error: "部署を特定できませんでした" }
  }

  const deleted = await deleteOrgDepartment(code)

  if (deleted instanceof Error) {
    return {
      ok: false,
      error: "部署の削除に失敗しました（子部署や所属が残っている可能性があります）",
    }
  }

  revalidatePath("/org")

  return { ok: true, error: null }
}

// FormData 値を文字列へ。未入力や空白のみは null。
function toText(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string" || value.trim() === "") {
    return null
  }

  return value.trim()
}

// FormData 値を整数へ。未入力や不正値は null。
function toNumber(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || value === "") {
    return null
  }

  const parsed = Number(value)

  if (Number.isInteger(parsed) === false) {
    return null
  }

  return parsed
}
