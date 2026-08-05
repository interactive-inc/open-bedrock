"use server"

import { revalidatePath } from "next/cache"
import { createHealthCheckup } from "@/lib/api/create-health-checkup"
import { getMe } from "@/lib/api/get-me"
import { FORM_CONSTRAINTS } from "@/lib/form/constraints"
import { toOptionalIsoDate } from "@/lib/form/to-optional-iso-date"
import { toOptionalText } from "@/lib/form/to-optional-text"
import { toRequiredIntInRange } from "@/lib/form/to-required-int-in-range"
import { toRequiredText } from "@/lib/form/to-required-text"
import { canManageHealthCheckups } from "@/lib/health-checkup/can-manage-health-checkups"

/** useActionState で参照する共通の戻り値。ok=成功 / error=表示するエラー文言。 */
export type HealthCheckupActionState = {
  ok: boolean
  error: string | null
}

/** 実施記録の登録 Server Action。対象者・年度・種別は必須、実施日・状態・備考は任意。 */
export async function createHealthCheckupAction(
  previousState: HealthCheckupActionState,
  formData: FormData,
): Promise<HealthCheckupActionState> {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canManageHealthCheckups(currentUser.permissions) === false) {
    return { ok: false, error: "実施記録を登録する権限がありません" }
  }

  const employeeCode = toRequiredText(formData.get("employee_code"), {
    label: "対象者",
    max: FORM_CONSTRAINTS.employee.codeMax,
  })

  if (employeeCode instanceof Error) {
    return { ok: false, error: employeeCode.message }
  }

  const fiscalYear = toRequiredIntInRange(formData.get("fiscal_year"), {
    label: "年度",
    min: FORM_CONSTRAINTS.healthCheckup.fiscalYearMin,
    max: FORM_CONSTRAINTS.healthCheckup.fiscalYearMax,
  })

  if (fiscalYear instanceof Error) {
    return { ok: false, error: fiscalYear.message }
  }

  const checkupKind = formData.get("checkup_kind")

  if (checkupKind !== "regular" && checkupKind !== "stress_check") {
    return { ok: false, error: "種別を選択してください" }
  }

  const status = formData.get("status")

  if (status !== "scheduled" && status !== "completed" && status !== "declined") {
    return { ok: false, error: "受診状態を選択してください" }
  }

  const conductedOn = toOptionalIsoDate(formData.get("conducted_on"), "実施日")

  if (conductedOn instanceof Error) {
    return { ok: false, error: conductedOn.message }
  }

  const note = toOptionalText(formData.get("note"), {
    label: "備考",
    max: FORM_CONSTRAINTS.healthCheckup.noteMax,
  })

  if (note instanceof Error) {
    return { ok: false, error: note.message }
  }

  const created = await createHealthCheckup({
    employee_code: employeeCode,
    fiscal_year: fiscalYear,
    checkup_kind: checkupKind,
    conducted_on: conductedOn ?? undefined,
    status: status,
    note: note ?? undefined,
  })

  if (created instanceof Error) {
    return { ok: false, error: created.message }
  }

  revalidatePath("/organization/health-checkups")

  return { ok: true, error: null }
}
