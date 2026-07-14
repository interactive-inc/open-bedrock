"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createEmployee } from "@/lib/api/create-employee"
import { archiveEmployee } from "@/lib/api/archive-employee"
import { updateEmployee } from "@/lib/api/update-employee"
import type { EmployeeRole } from "@/lib/api/types/employee-types"
import { canCreateEmployee } from "@/lib/employee/can-create-employee"
import { canArchiveEmployee } from "@/lib/employee/can-archive-employee"
import { canUpdateEmployee } from "@/lib/employee/can-update-employee"
import { requireAuth } from "@/lib/auth/require-auth"
import {
  FORM_CONSTRAINTS,
  isValidEmail,
  toOptionalText,
  toRequiredIsoDate,
  toRequiredText,
} from "@/lib/form/constraints"

export type EmployeeCreateFormState = {
  ok: boolean
  error: string | null
}

export type EmployeeUpdateFormState = {
  ok: boolean
  error: string | null
}

export type EmployeeArchiveFormState = {
  ok: boolean
  error: string | null
}

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

// 人物台帳、入社発令、初期アカウントを一括作成する Server Action。
// バリデーションエラーは集約して一度に返す。
export async function createEmployeeAction(
  previousState: EmployeeCreateFormState,
  formData: FormData,
): Promise<EmployeeCreateFormState> {
  const currentUser = await requireAuth()

  if (canCreateEmployee(currentUser.permissions) === false) {
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

  const hireOn = toRequiredIsoDate(formData.get("hire_on"), "入社日")

  if (role === null) {
    errors.push("ロールを入力してください")
  }

  if (hireOn instanceof Error) errors.push(hireOn.message)

  const departmentCode = toOptionalText(formData.get("department_code"), {
    label: "部署コード",
    max: FORM_CONSTRAINTS.employee.codeMax,
  })

  if (departmentCode instanceof Error) {
    errors.push(departmentCode.message)
  }

  const position = toOptionalText(formData.get("position_title"), {
    label: "役職",
    max: FORM_CONSTRAINTS.employee.positionMax,
  })

  if (position instanceof Error) {
    errors.push(position.message)
  }

  const managerEmployeeCode = toOptionalText(formData.get("manager_employee_code"), {
    label: "直属上司コード",
    max: FORM_CONSTRAINTS.employee.codeMax,
  })
  if (managerEmployeeCode instanceof Error) errors.push(managerEmployeeCode.message)

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
    hire_on: hireOn as string,
    department_code: departmentCode as string | null,
    position_title: position as string | null,
    manager_employee_code: managerEmployeeCode as string | null,
  })

  if (created instanceof Error) {
    return { ok: false, error: created.message }
  }

  revalidatePath("/employees")

  return { ok: true, error: null }
}

// 人物台帳の氏名更新。IAM と人事ライフサイクルの項目は専用操作でのみ変更する。
export async function updateEmployeeAction(
  previousState: EmployeeUpdateFormState,
  formData: FormData,
): Promise<EmployeeUpdateFormState> {
  const currentUser = await requireAuth()

  if (canUpdateEmployee(currentUser.permissions) === false) {
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

  const updated = await updateEmployee(code, { name })

  if (updated instanceof Error) {
    return { ok: false, error: updated.message }
  }

  revalidatePath("/employees")

  revalidatePath(`/employees/${code}`)

  return { ok: true, error: null }
}

export async function archiveEmployeeAction(
  previousState: EmployeeArchiveFormState,
  formData: FormData,
): Promise<EmployeeArchiveFormState> {
  const currentUser = await requireAuth()
  if (!canArchiveEmployee(currentUser.permissions)) {
    return { ok: false, error: "従業員をアーカイブする権限がありません" }
  }
  const code = toRequiredText(formData.get("code"), {
    label: "従業員コード",
    max: FORM_CONSTRAINTS.employee.codeMax,
  })
  if (code instanceof Error) return { ok: false, error: code.message }
  const archived = await archiveEmployee(code)
  if (archived instanceof Error) return { ok: false, error: archived.message }
  revalidatePath("/employees")
  redirect("/employees")
}
