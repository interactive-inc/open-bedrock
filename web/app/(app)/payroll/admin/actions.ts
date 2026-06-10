"use server"

import { revalidatePath } from "next/cache"
import { cancelPayslip } from "@/lib/api/cancel-payslip"
import { cancelSalaryRevision } from "@/lib/api/cancel-salary-revision"
import { correctPayslip } from "@/lib/api/correct-payslip"
import { correctSalaryRevision } from "@/lib/api/correct-salary-revision"
import { createSalaryRevision } from "@/lib/api/create-salary-revision"
import { getMe } from "@/lib/api/get-me"
import { issuePayslip } from "@/lib/api/issue-payslip"
import { toPositiveIntId } from "@/lib/form/to-positive-int-id"
import { canManagePayroll } from "@/lib/payroll/can-manage-payroll"

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
  const currentUser = await getMe()

  if (currentUser instanceof Error || canManagePayroll(currentUser.role) === false) {
    return { ok: false, error: "給与を管理する権限がありません" }
  }

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

  if (!Number.isFinite(baseSalary) || !Number.isInteger(baseSalary) || baseSalary < 0) {
    return { ok: false, error: "基本給は 0 以上の整数で入力してください" }
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
  const currentUser = await getMe()

  if (currentUser instanceof Error || canManagePayroll(currentUser.role) === false) {
    return { ok: false, error: "給与を管理する権限がありません" }
  }

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

  if (!Number.isFinite(newBaseSalary) || !Number.isInteger(newBaseSalary) || newBaseSalary < 0) {
    return { ok: false, error: "改定後基本給は 0 以上の整数で入力してください" }
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

// 給与明細の訂正 Server Action。payslip_id/period/base_salary 必須、手当・控除は任意。
// net_pay は base_salary + allowances - deductions で自動算出する。
export async function correctPayslipAction(
  previousState: PayrollAdminFormState,
  formData: FormData,
): Promise<PayrollAdminFormState> {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canManagePayroll(currentUser.role) === false) {
    return { ok: false, error: "給与を管理する権限がありません" }
  }

  const payslipId = toPositiveIntId(formData.get("payslip_id"))

  if (payslipId === null) {
    return { ok: false, error: "給与明細 ID を入力してください" }
  }

  const periodValue = formData.get("period")

  const period = typeof periodValue === "string" ? periodValue.trim() : ""

  if (period === "") {
    return { ok: false, error: "対象期間を入力してください" }
  }

  const baseSalary = Number(formData.get("base_salary"))

  if (!Number.isFinite(baseSalary) || !Number.isInteger(baseSalary) || baseSalary < 0) {
    return { ok: false, error: "基本給は 0 以上の整数で入力してください" }
  }

  const allowances = toNonNegativeNumber(formData.get("allowances"))

  const deductions = toNonNegativeNumber(formData.get("deductions"))

  const netPay = baseSalary + allowances - deductions

  const corrected = await correctPayslip(payslipId, {
    period: period,
    base_salary: baseSalary,
    allowances: allowances,
    deductions: deductions,
    net_pay: netPay,
  })

  if (corrected instanceof Error) {
    return { ok: false, error: "給与明細の訂正に失敗しました" }
  }

  revalidatePath("/payroll")

  return { ok: true, error: null }
}

// 給与明細の取消 Server Action。payslip_id 必須。記録の削除のみを行う。
export async function cancelPayslipAction(
  previousState: PayrollAdminFormState,
  formData: FormData,
): Promise<PayrollAdminFormState> {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canManagePayroll(currentUser.role) === false) {
    return { ok: false, error: "給与を管理する権限がありません" }
  }

  const payslipId = toPositiveIntId(formData.get("payslip_id"))

  if (payslipId === null) {
    return { ok: false, error: "給与明細 ID を入力してください" }
  }

  const cancelled = await cancelPayslip(payslipId)

  if (cancelled instanceof Error) {
    return { ok: false, error: "給与明細の取消に失敗しました" }
  }

  revalidatePath("/payroll")

  return { ok: true, error: null }
}

// 給与改定の訂正 Server Action。id/effective_date/new_base_salary 必須、理由は任意。
export async function correctSalaryRevisionAction(
  previousState: PayrollAdminFormState,
  formData: FormData,
): Promise<PayrollAdminFormState> {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canManagePayroll(currentUser.role) === false) {
    return { ok: false, error: "給与を管理する権限がありません" }
  }

  const salaryRevisionId = toPositiveIntId(formData.get("id"))

  if (salaryRevisionId === null) {
    return { ok: false, error: "対象の給与改定が不正です" }
  }

  const effectiveDateValue = formData.get("effective_date")

  const effectiveDate = typeof effectiveDateValue === "string" ? effectiveDateValue : ""

  if (effectiveDate === "") {
    return { ok: false, error: "適用日を入力してください" }
  }

  const newBaseSalary = Number(formData.get("new_base_salary"))

  if (!Number.isFinite(newBaseSalary) || !Number.isInteger(newBaseSalary) || newBaseSalary < 0) {
    return { ok: false, error: "改定後基本給は 0 以上の整数で入力してください" }
  }

  const reasonValue = formData.get("reason")

  const reason =
    typeof reasonValue === "string" && reasonValue.trim() !== "" ? reasonValue.trim() : null

  const corrected = await correctSalaryRevision(salaryRevisionId, {
    effective_date: effectiveDate,
    new_base_salary: newBaseSalary,
    reason: reason,
  })

  if (corrected instanceof Error) {
    return { ok: false, error: "給与改定の訂正に失敗しました" }
  }

  revalidatePath("/payroll/salary-revisions")

  return { ok: true, error: null }
}

// 給与改定の取消 Server Action。id 必須。記録を削除する。
export async function cancelSalaryRevisionAction(
  previousState: PayrollAdminFormState,
  formData: FormData,
): Promise<PayrollAdminFormState> {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canManagePayroll(currentUser.role) === false) {
    return { ok: false, error: "給与を管理する権限がありません" }
  }

  const salaryRevisionId = toPositiveIntId(formData.get("id"))

  if (salaryRevisionId === null) {
    return { ok: false, error: "対象の給与改定が不正です" }
  }

  const cancelled = await cancelSalaryRevision(salaryRevisionId)

  if (cancelled instanceof Error) {
    return { ok: false, error: "給与改定の取消に失敗しました" }
  }

  revalidatePath("/payroll/salary-revisions")

  return { ok: true, error: null }
}

// FormData の数値を 0 以上の整数へ。未入力・不正値・小数・負値は 0 とする。
function toNonNegativeNumber(value: FormDataEntryValue | null): number {
  const parsed = Number(value)

  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 0) {
    return 0
  }

  return parsed
}
