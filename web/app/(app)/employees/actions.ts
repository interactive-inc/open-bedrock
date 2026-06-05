"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createEmployee } from "@/lib/api/create-employee"
import { deleteEmployee } from "@/lib/api/delete-employee"
import { updateEmployee } from "@/lib/api/update-employee"
import type { EmployeeStatus } from "@/lib/api/types/employee-types"
import { toPositiveIntId } from "@/lib/form/to-positive-int-id"

export type EmployeeCreateFormState = {
  ok: boolean
  error: string | null
}

export type EmployeeUpdateFormState = {
  ok: boolean
  error: string | null
}

export type EmployeeDeleteFormState = {
  ok: boolean
  error: string | null
}

const employeeStatuses: ReadonlyArray<EmployeeStatus> = ["active", "leave", "retired"]

// FormData の文字列を在籍状況 enum へ検証付きで変換する。不正なら null。
function toStatus(value: FormDataEntryValue | null): EmployeeStatus | null {
  if (typeof value !== "string") {
    return null
  }

  for (const status of employeeStatuses) {
    if (status === value) {
      return status
    }
  }

  return null
}

// FormData の文字列を非空の文字列へ。未入力や空文字は null。
function toText(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string" || value.trim() === "") {
    return null
  }

  return value.trim()
}

// 従業員登録の Server Action。code/name/email/password/role/status 必須、部署・役職は任意。
export async function createEmployeeAction(
  previousState: EmployeeCreateFormState,
  formData: FormData,
): Promise<EmployeeCreateFormState> {
  const code = toText(formData.get("code"))

  const name = toText(formData.get("name"))

  const email = toText(formData.get("email"))

  const password = toText(formData.get("password"))

  const role = toText(formData.get("role"))

  const status = toStatus(formData.get("status"))

  if (code === null || name === null || email === null || password === null || role === null) {
    return { ok: false, error: "コード・氏名・メール・初期パスワード・ロールを入力してください" }
  }

  if (status === null) {
    return { ok: false, error: "在籍状況を選択してください" }
  }

  const created = await createEmployee({
    code: code,
    name: name,
    email: email,
    password: password,
    role: role,
    dept_id: toPositiveIntId(formData.get("dept_id")),
    dept_name: toText(formData.get("dept_name")),
    position: toText(formData.get("position")),
    status: status,
  })

  if (created instanceof Error) {
    return {
      ok: false,
      error: "従業員の登録に失敗しました（コードが重複している可能性があります）",
    }
  }

  revalidatePath("/employees")

  return { ok: true, error: null }
}

// 従業員更新の Server Action。code は hidden、氏名・メール・ロール・部署・役職・在籍状況を変更する。
export async function updateEmployeeAction(
  previousState: EmployeeUpdateFormState,
  formData: FormData,
): Promise<EmployeeUpdateFormState> {
  const code = toText(formData.get("code"))

  if (code === null) {
    return { ok: false, error: "従業員を特定できませんでした" }
  }

  const name = toText(formData.get("name"))

  const email = toText(formData.get("email"))

  const role = toText(formData.get("role"))

  const status = toStatus(formData.get("status"))

  if (name === null || email === null || role === null) {
    return { ok: false, error: "氏名・メール・ロールを入力してください" }
  }

  if (status === null) {
    return { ok: false, error: "在籍状況を選択してください" }
  }

  const updated = await updateEmployee(code, {
    name: name,
    email: email,
    role: role,
    dept_id: toPositiveIntId(formData.get("dept_id")),
    dept_name: toText(formData.get("dept_name")),
    position: toText(formData.get("position")),
    status: status,
  })

  if (updated instanceof Error) {
    return { ok: false, error: "従業員の更新に失敗しました" }
  }

  revalidatePath("/employees")

  revalidatePath(`/employees/${code}`)

  return { ok: true, error: null }
}

// 従業員削除の Server Action。code は hidden から受け取る。自分自身は api が 409 を返し失敗する。
export async function deleteEmployeeAction(
  previousState: EmployeeDeleteFormState,
  formData: FormData,
): Promise<EmployeeDeleteFormState> {
  const code = toText(formData.get("code"))

  if (code === null) {
    return { ok: false, error: "従業員を特定できませんでした" }
  }

  const deleted = await deleteEmployee(code)

  if (deleted instanceof Error) {
    return { ok: false, error: "従業員の削除に失敗しました（自分自身は削除できません）" }
  }

  revalidatePath("/employees")

  // 削除後は詳細ページが消えるため一覧へ遷移する。redirect は内部で throw するので最後に呼ぶ。
  redirect("/employees")
}
