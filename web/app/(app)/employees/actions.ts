"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createEmployee } from "@/lib/api/create-employee"
import { deleteEmployee } from "@/lib/api/delete-employee"
import { getMe } from "@/lib/api/get-me"
import { updateEmployee } from "@/lib/api/update-employee"
import type { EmployeeRole, EmployeeStatus } from "@/lib/api/types/employee-types"
import { canCreateEmployee } from "@/lib/employee/can-create-employee"
import { canDeleteEmployee } from "@/lib/employee/can-delete-employee"
import { canUpdateEmployee } from "@/lib/employee/can-update-employee"
import {
  FORM_CONSTRAINTS,
  isValidEmail,
  toOptionalText,
  toRequiredText,
} from "@/lib/form/constraints"
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

const employeeRoles: ReadonlyArray<EmployeeRole> = ["member", "manager", "hr", "admin"]

// FormData の文字列をロール enum へ検証付きで変換する。不正なら null。
function toRole(value: FormDataEntryValue | null): EmployeeRole | null {
  if (typeof value !== "string") {
    return null
  }

  for (const role of employeeRoles) {
    if (role === value) {
      return role
    }
  }

  return null
}

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

// 従業員登録の Server Action。code/name/email/password/role/status 必須、部署・役職は任意。
// バリデーションエラーは集約して一度に返す。
export async function createEmployeeAction(
  previousState: EmployeeCreateFormState,
  formData: FormData,
): Promise<EmployeeCreateFormState> {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canCreateEmployee(currentUser.permissions) === false) {
    return { ok: false, error: "従業員を登録する権限がありません" }
  }

  const errors: Array<string> = []

  const code = toRequiredText(formData.get("code"), {
    label: "コード",
    max: FORM_CONSTRAINTS.employee.codeMax,
  })

  if (code instanceof Error) {
    errors.push(code.message)
  }

  const name = toRequiredText(formData.get("name"), {
    label: "氏名",
    max: FORM_CONSTRAINTS.employee.nameMax,
  })

  if (name instanceof Error) {
    errors.push(name.message)
  }

  const email = toRequiredText(formData.get("email"), {
    label: "メール",
    max: FORM_CONSTRAINTS.employee.emailMax,
  })

  if (email instanceof Error) {
    errors.push(email.message)
  } else if (isValidEmail(email) === false) {
    errors.push("メールはメールアドレス形式で入力してください")
  }

  const password = toRequiredText(formData.get("password"), {
    label: "初期パスワード",
    min: FORM_CONSTRAINTS.employee.passwordMin,
    max: FORM_CONSTRAINTS.employee.passwordMax,
  })

  if (password instanceof Error) {
    errors.push(password.message)
  }

  const role = toRole(formData.get("role"))

  const status = toStatus(formData.get("status"))

  if (role === null) {
    errors.push("ロールを入力してください")
  }

  if (status === null) {
    errors.push("在籍状況を選択してください")
  }

  const deptName = toOptionalText(formData.get("dept_name"), {
    label: "部署名",
    max: FORM_CONSTRAINTS.employee.deptNameMax,
  })

  if (deptName instanceof Error) {
    errors.push(deptName.message)
  }

  const position = toOptionalText(formData.get("position"), {
    label: "役職",
    max: FORM_CONSTRAINTS.employee.positionMax,
  })

  if (position instanceof Error) {
    errors.push(position.message)
  }

  if (errors.length > 0) {
    return { ok: false, error: errors.join("、") }
  }

  // errors.length === 0 なら全フィールドは非 Error 確定
  const created = await createEmployee({
    code: code as string,
    name: name as string,
    email: email as string,
    password: password as string,
    role: role as EmployeeRole,
    dept_id: toPositiveIntId(formData.get("dept_id")),
    dept_name: deptName as string | null,
    position: position as string | null,
    status: status as EmployeeStatus,
  })

  if (created instanceof Error) {
    return { ok: false, error: created.message }
  }

  revalidatePath("/employees")

  return { ok: true, error: null }
}

// 従業員更新の Server Action。code は hidden、氏名・メール・ロール・部署・役職・在籍状況を変更する。
export async function updateEmployeeAction(
  previousState: EmployeeUpdateFormState,
  formData: FormData,
): Promise<EmployeeUpdateFormState> {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canUpdateEmployee(currentUser.permissions) === false) {
    return { ok: false, error: "従業員を更新する権限がありません" }
  }

  const code = toRequiredText(formData.get("code"), {
    label: "従業員コード",
    max: FORM_CONSTRAINTS.employee.codeMax,
  })

  if (code instanceof Error) {
    return { ok: false, error: code.message }
  }

  const name = toRequiredText(formData.get("name"), {
    label: "氏名",
    max: FORM_CONSTRAINTS.employee.nameMax,
  })

  if (name instanceof Error) {
    return { ok: false, error: name.message }
  }

  const status = toStatus(formData.get("status"))

  if (status === null) {
    return { ok: false, error: "在籍状況を選択してください" }
  }

  const deptName = toOptionalText(formData.get("dept_name"), {
    label: "部署名",
    max: FORM_CONSTRAINTS.employee.deptNameMax,
  })

  if (deptName instanceof Error) {
    return { ok: false, error: deptName.message }
  }

  const position = toOptionalText(formData.get("position"), {
    label: "役職",
    max: FORM_CONSTRAINTS.employee.positionMax,
  })

  if (position instanceof Error) {
    return { ok: false, error: position.message }
  }

  const updated = await updateEmployee(code, {
    name: name,
    dept_id: toPositiveIntId(formData.get("dept_id")),
    dept_name: deptName,
    position: position,
    status: status,
  })

  if (updated instanceof Error) {
    return { ok: false, error: updated.message }
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
  const currentUser = await getMe()

  if (currentUser instanceof Error || canDeleteEmployee(currentUser.permissions) === false) {
    return { ok: false, error: "従業員を削除する権限がありません" }
  }

  const code = toRequiredText(formData.get("code"), {
    label: "従業員コード",
    max: FORM_CONSTRAINTS.employee.codeMax,
  })

  if (code instanceof Error) {
    return { ok: false, error: code.message }
  }

  const deleted = await deleteEmployee(code)

  if (deleted instanceof Error) {
    return { ok: false, error: deleted.message }
  }

  revalidatePath("/employees")

  // 削除後は詳細ページが消えるため一覧へ遷移する。redirect は内部で throw するので最後に呼ぶ。
  redirect("/employees")
}
