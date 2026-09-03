"use server"

import { applyPersonnelAction } from "@/lib/api/apply-personnel-action"
import { createEmployeeEvent } from "@/lib/api/create-employee-event"
import { createPersonnelActionRequest } from "@/lib/api/create-personnel-action-request"
import { createSalaryRevision } from "@/lib/api/create-salary-revision"
import { getMe } from "@/lib/api/get-me"
import { requireAuth } from "@/lib/auth/require-auth"
import { canManageEmployeeEvents } from "@/lib/employee-event/can-manage-employee-events"
import { FORM_CONSTRAINTS } from "@/lib/form/constraints"
import { toOptionalText } from "@/lib/form/to-optional-text"
import { toRequiredIntInRange } from "@/lib/form/to-required-int-in-range"
import { toRequiredIsoDate } from "@/lib/form/to-required-iso-date"
import { canManageSalaryRevisions } from "@/lib/salary-revision/can-manage-salary-revisions"
import { revalidatePath } from "next/cache"

export type PersonnelActionFormState = { ok: boolean; error: string | null }

function text(form: FormData, name: string): string | null {
  const value = form.get(name)
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null
}

function buildAction(form: FormData): Record<string, unknown> | Error {
  const kind = text(form, "kind")
  const employeeCode = text(form, "employee_code")
  const eventOn = toRequiredIsoDate(form.get("event_on"), "発令日")
  if (!kind || !employeeCode) return new Error("種別と対象者が必要です")
  if (eventOn instanceof Error) return eventOn
  if (kind === "retired") return { kind, employeeCode, retirementOn: eventOn }
  const base = { kind, employeeCode, eventOn }
  if (kind === "rehire") {
    return {
      ...base,
      departmentCode: text(form, "department_code"),
      positionCode: text(form, "position_code"),
      managerEmployeeCode: text(form, "manager_employee_code"),
    }
  }
  if (["leave_started", "returned"].includes(kind)) return base
  const departmentCode = text(form, "department_code")
  if (!departmentCode) return new Error("この発令種別には部署コードが必要です")
  if (
    ["primary_assignment_started", "transferred", "concurrent_assignment_started"].includes(kind)
  ) {
    return {
      ...base,
      departmentCode,
      positionCode: text(form, "position_code"),
      managerEmployeeCode: text(form, "manager_employee_code"),
    }
  }
  if (["department_responsibility_started", "department_responsibility_ended"].includes(kind)) {
    return { ...base, departmentCode }
  }
  const assignmentType = text(form, "assignment_type")
  if (assignmentType !== "primary" && assignmentType !== "concurrent") {
    return new Error("所属区分が必要です")
  }
  if (kind === "assignment_ended") return { ...base, departmentCode, assignmentType }
  if (kind === "manager_changed") {
    return {
      ...base,
      departmentCode,
      assignmentType,
      managerEmployeeCode: text(form, "manager_employee_code"),
    }
  }
  if (kind === "position_changed") {
    const positionCode = text(form, "position_code")
    const changeType = text(form, "change_type")
    if (!positionCode || !changeType) return new Error("役職と変更区分が必要です")
    return { ...base, departmentCode, assignmentType, positionCode, changeType }
  }
  return new Error("人事発令種別が不正です")
}

export async function submitPersonnelAction(
  previous: PersonnelActionFormState,
  form: FormData,
): Promise<PersonnelActionFormState> {
  const me = await requireAuth()
  const mode = text(form, "mode")
  const requiredPermission =
    mode === "apply" ? "employee:lifecycle:apply" : "employee:lifecycle:request"
  if (!me.permissions.includes(requiredPermission)) {
    return { ok: false, error: "この人事変更を実行する権限がありません" }
  }
  const action = buildAction(form)
  if (action instanceof Error) return { ok: false, error: action.message }
  const employeeRevisionText = text(form, "employee_revision")
  const organizationRevisionText = text(form, "organization_revision")
  const employeeRevision = Number(employeeRevisionText)
  const organizationRevision = Number(organizationRevisionText)
  if (
    employeeRevisionText === null ||
    organizationRevisionText === null ||
    !Number.isInteger(employeeRevision) ||
    employeeRevision < 0 ||
    !Number.isInteger(organizationRevision) ||
    organizationRevision < 0
  ) {
    return { ok: false, error: "画面を再読み込みして最新の人事情報を取得してください" }
  }
  const result =
    mode === "apply"
      ? await applyPersonnelAction(
          {
            action,
            expected_employee_revision: employeeRevision,
            expected_organization_revision: organizationRevision,
          },
          crypto.randomUUID(),
        )
      : await createPersonnelActionRequest({
          action,
          base_employee_revision: employeeRevision,
          base_organization_revision: organizationRevision,
        })
  if (result instanceof Error) return { ok: false, error: result.message }
  const code = text(form, "employee_code")
  revalidatePath("/company/employees")
  if (code) revalidatePath(`/company/employees/${code}`)
  return { ok: true, error: null }
}

/** useActionState で参照する事実記録フォーム共通の戻り値。ok=成功 / error=表示するエラー文言。 */
export type FactRecordFormState = { ok: boolean; error: string | null }

/** 異動・在籍イベントの記録 Server Action。対象者コード・種別・適用日は必須、部署コードと備考は任意。 */
export async function createEmployeeEventAction(
  previousState: FactRecordFormState,
  formData: FormData,
): Promise<FactRecordFormState> {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canManageEmployeeEvents(currentUser.permissions) === false) {
    return { ok: false, error: "異動・在籍イベントを記録する権限がありません" }
  }

  const employeeCode = text(formData, "employee_code")

  if (employeeCode === null) {
    return { ok: false, error: "対象者を特定できませんでした" }
  }

  const kind = formData.get("kind")

  if (
    kind !== "join" &&
    kind !== "transfer" &&
    kind !== "leave_of_absence" &&
    kind !== "return" &&
    kind !== "retire"
  ) {
    return { ok: false, error: "種別を選択してください" }
  }

  const effectiveDate = toRequiredIsoDate(formData.get("effective_date"), "適用日")

  if (effectiveDate instanceof Error) {
    return { ok: false, error: effectiveDate.message }
  }

  const fromDepartmentCode = toOptionalText(formData.get("from_department_code"), {
    label: "異動元部署コード",
    max: FORM_CONSTRAINTS.employeeEvent.departmentCodeMax,
  })

  if (fromDepartmentCode instanceof Error) {
    return { ok: false, error: fromDepartmentCode.message }
  }

  const toDepartmentCode = toOptionalText(formData.get("to_department_code"), {
    label: "異動先部署コード",
    max: FORM_CONSTRAINTS.employeeEvent.departmentCodeMax,
  })

  if (toDepartmentCode instanceof Error) {
    return { ok: false, error: toDepartmentCode.message }
  }

  const note = toOptionalText(formData.get("note"), {
    label: "備考",
    max: FORM_CONSTRAINTS.employeeEvent.noteMax,
  })

  if (note instanceof Error) {
    return { ok: false, error: note.message }
  }

  const created = await createEmployeeEvent({
    employee_code: employeeCode,
    kind: kind,
    effective_date: effectiveDate,
    from_department_code: fromDepartmentCode ?? undefined,
    to_department_code: toDepartmentCode ?? undefined,
    note: note ?? undefined,
  })

  if (created instanceof Error) {
    return { ok: false, error: created.message }
  }

  revalidatePath(`/company/employees/${employeeCode}`)

  return { ok: true, error: null }
}

/** 給与改定の事実記録 Server Action。対象者コード・適用日・前後の基本給は必須、理由は任意。最機微。 */
export async function createSalaryRevisionAction(
  previousState: FactRecordFormState,
  formData: FormData,
): Promise<FactRecordFormState> {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canManageSalaryRevisions(currentUser.permissions) === false) {
    return { ok: false, error: "給与改定を記録する権限がありません" }
  }

  const employeeCode = text(formData, "employee_code")

  if (employeeCode === null) {
    return { ok: false, error: "対象者を特定できませんでした" }
  }

  const effectiveDate = toRequiredIsoDate(formData.get("effective_date"), "適用日")

  if (effectiveDate instanceof Error) {
    return { ok: false, error: effectiveDate.message }
  }

  const previousBaseSalary = toRequiredIntInRange(formData.get("previous_base_salary"), {
    label: "前回基本給",
    min: FORM_CONSTRAINTS.salaryRevision.baseSalaryMin,
    max: FORM_CONSTRAINTS.salaryRevision.baseSalaryMax,
  })

  if (previousBaseSalary instanceof Error) {
    return { ok: false, error: previousBaseSalary.message }
  }

  const newBaseSalary = toRequiredIntInRange(formData.get("new_base_salary"), {
    label: "改定後基本給",
    min: FORM_CONSTRAINTS.salaryRevision.baseSalaryMin,
    max: FORM_CONSTRAINTS.salaryRevision.baseSalaryMax,
  })

  if (newBaseSalary instanceof Error) {
    return { ok: false, error: newBaseSalary.message }
  }

  const reason = toOptionalText(formData.get("reason"), {
    label: "理由",
    max: FORM_CONSTRAINTS.salaryRevision.reasonMax,
  })

  if (reason instanceof Error) {
    return { ok: false, error: reason.message }
  }

  const created = await createSalaryRevision({
    employee_code: employeeCode,
    effective_date: effectiveDate,
    previous_base_salary: previousBaseSalary,
    new_base_salary: newBaseSalary,
    reason: reason ?? undefined,
  })

  if (created instanceof Error) {
    return { ok: false, error: created.message }
  }

  revalidatePath(`/company/employees/${employeeCode}`)

  return { ok: true, error: null }
}
