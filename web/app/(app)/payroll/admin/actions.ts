"use server"

import { revalidatePath } from "next/cache"
import { createSalaryRevision } from "@/lib/api/create-salary-revision"
import { issuePayslip } from "@/lib/api/issue-payslip"

// useActionState で参照する共通の戻り値。ok=成功 / error=表示するエラー文言。
export type PayrollAdminFormState = {
  ok: boolean
  error: string | null
}

// 給与明細の発行 Server Action。employee_code/period/base_salary 必須、手当・控除は任意。
export async function issuePayslipAction(
  previousState: PayrollAdminFormState,
  formData: FormData,
): Promise<PayrollAdminFormState> {
  const employeeCodeValue = formData.get("employee_code")

  const employeeCode = typeof employeeCodeValue === "string" ? employeeCodeValue.trim() : ""

  if (employeeCode === "") {
    return { ok: false, error: "社員コードを入力してください" }
  }

  const periodValue = formData.get("period")

  const period = typeof periodValue === "string" ? periodValue.trim() : ""

  if (period === "") {
    return { ok: false, error: "対象期間を入力してください" }
  }

  const baseSalary = Number(formData.get("base_salary"))

  if (!Number.isFinite(baseSalary) || baseSalary < 0) {
    return { ok: false, error: "基本給は 0 以上の数で入力してください" }
  }

  const allowances = toNonNegativeNumber(formData.get("allowances"))

  const deductions = toNonNegativeNumber(formData.get("deductions"))

  const issued = await issuePayslip({
    employee_code: employeeCode,
    period: period,
    base_salary: baseSalary,
    allowances: allowances,
    deductions: deductions,
  })

  if (issued instanceof Error) {
    return { ok: false, error: "給与明細の発行に失敗しました" }
  }

  revalidatePath("/payroll")

  return { ok: true, error: null }
}

// 給与改定の作成 Server Action。employee_code/effective_date/new_base_salary 必須、理由は任意。
export async function createSalaryRevisionAction(
  previousState: PayrollAdminFormState,
  formData: FormData,
): Promise<PayrollAdminFormState> {
  const employeeCodeValue = formData.get("employee_code")

  const employeeCode = typeof employeeCodeValue === "string" ? employeeCodeValue.trim() : ""

  if (employeeCode === "") {
    return { ok: false, error: "社員コードを入力してください" }
  }

  const effectiveDateValue = formData.get("effective_date")

  const effectiveDate = typeof effectiveDateValue === "string" ? effectiveDateValue : ""

  if (effectiveDate === "") {
    return { ok: false, error: "適用日を入力してください" }
  }

  const newBaseSalary = Number(formData.get("new_base_salary"))

  if (!Number.isFinite(newBaseSalary) || newBaseSalary < 0) {
    return { ok: false, error: "改定後基本給は 0 以上の数で入力してください" }
  }

  const reasonValue = formData.get("reason")

  const reason =
    typeof reasonValue === "string" && reasonValue.trim() !== "" ? reasonValue.trim() : undefined

  const created = await createSalaryRevision({
    employee_code: employeeCode,
    effective_date: effectiveDate,
    new_base_salary: newBaseSalary,
    reason: reason,
  })

  if (created instanceof Error) {
    return { ok: false, error: "給与改定の作成に失敗しました" }
  }

  revalidatePath("/payroll/salary-revisions")

  return { ok: true, error: null }
}

// FormData の数値を 0 以上の number へ。未入力・不正値は 0 とする。
function toNonNegativeNumber(value: FormDataEntryValue | null): number {
  const parsed = Number(value)

  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0
  }

  return parsed
}
