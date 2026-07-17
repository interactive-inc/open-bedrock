"use server"

import { revalidatePath } from "next/cache"
import { acknowledgeGovernanceDocument } from "@/lib/api/acknowledge-governance-document"
import { assignGovernanceOrgRole } from "@/lib/api/assign-governance-org-role"
import { publishGovernanceDocument } from "@/lib/api/publish-governance-document"
import { reviewGovernanceDocument } from "@/lib/api/review-governance-document"
import { revokeGovernanceOrgRole } from "@/lib/api/revoke-governance-org-role"
import { submitGovernanceReview } from "@/lib/api/submit-governance-review"
import { requireAuth } from "@/lib/auth/require-auth"

export type GovernanceActionState = { ok: boolean; error: string | null }

const initialError = (message: string): GovernanceActionState => ({ ok: false, error: message })

export async function acknowledgeGovernanceAction(
  _state: GovernanceActionState,
  formData: FormData,
): Promise<GovernanceActionState> {
  const me = await requireAuth()
  if (!me.permissions.includes("governance:acknowledge"))
    return initialError("確認を記録する権限がありません")
  const code = toRequiredText(formData.get("code"), 120)
  if (code === null) return initialError("文書を特定できません")
  const result = await acknowledgeGovernanceDocument(code)
  if (result instanceof Error) return initialError(result.message)
  revalidatePath(`/organization/governance/${code}`)
  return { ok: true, error: null }
}

export async function submitGovernanceReviewAction(
  _state: GovernanceActionState,
  formData: FormData,
): Promise<GovernanceActionState> {
  const me = await requireAuth()
  if (!me.permissions.includes("governance:manage"))
    return initialError("レビューへ提出する権限がありません")
  const code = toRequiredText(formData.get("code"), 120)
  const version = toRequiredText(formData.get("version"), 80)
  if (code === null || version === null) return initialError("文書版を特定できません")
  const result = await submitGovernanceReview(code, version)
  if (result instanceof Error) return initialError(result.message)
  revalidateGovernance(code)
  return { ok: true, error: null }
}

export async function reviewGovernanceAction(
  _state: GovernanceActionState,
  formData: FormData,
): Promise<GovernanceActionState> {
  const me = await requireAuth()
  if (!me.permissions.includes("governance:review"))
    return initialError("レビューする権限がありません")
  const code = toRequiredText(formData.get("code"), 120)
  const version = toRequiredText(formData.get("version"), 80)
  const orgRoleCode = toRequiredText(formData.get("org_role_code"), 120)
  const decisionValue = formData.get("decision")
  const decision =
    decisionValue === "approved" || decisionValue === "rejected" ? decisionValue : null
  const comment = toOptionalText(formData.get("comment"), 2_000)
  if (
    code === null ||
    version === null ||
    orgRoleCode === null ||
    decision === null ||
    comment instanceof Error
  ) {
    return initialError(comment instanceof Error ? comment.message : "レビュー入力が不正です")
  }
  const result = await reviewGovernanceDocument({ code, version, orgRoleCode, decision, comment })
  if (result instanceof Error) return initialError(result.message)
  revalidateGovernance(code)
  return { ok: true, error: null }
}

export async function publishGovernanceAction(
  _state: GovernanceActionState,
  formData: FormData,
): Promise<GovernanceActionState> {
  const me = await requireAuth()
  if (!me.permissions.includes("governance:publish"))
    return initialError("公開する権限がありません")
  const code = toRequiredText(formData.get("code"), 120)
  const version = toRequiredText(formData.get("version"), 80)
  if (code === null || version === null) return initialError("文書版を特定できません")
  const result = await publishGovernanceDocument(code, version)
  if (result instanceof Error) return initialError(result.message)
  revalidateGovernance(code)
  return { ok: true, error: null }
}

export async function assignGovernanceOrgRoleAction(
  _state: GovernanceActionState,
  formData: FormData,
): Promise<GovernanceActionState> {
  const me = await requireAuth()
  if (!me.permissions.includes("governance:manage"))
    return initialError("組織ロールを管理する権限がありません")
  const orgRoleCode = toRequiredText(formData.get("org_role_code"), 120)
  const employeeCode = toRequiredText(formData.get("employee_code"), 100)
  const startsOn = toIsoDate(formData.get("starts_on"))
  const departmentCode = toOptionalText(formData.get("department_code"), 100)
  const endsOnText = toOptionalText(formData.get("ends_on"), 10)
  const sourceDocumentCode = toOptionalText(formData.get("source_document_code"), 120)
  const endsOn =
    endsOnText instanceof Error || endsOnText === null ? endsOnText : toIsoDate(endsOnText)
  const error = [departmentCode, endsOn, sourceDocumentCode].find((value) => value instanceof Error)
  if (error instanceof Error) return initialError(error.message)
  if (
    orgRoleCode === null ||
    employeeCode === null ||
    startsOn === null ||
    startsOn instanceof Error
  ) {
    return initialError(startsOn instanceof Error ? startsOn.message : "必須項目を入力してください")
  }
  const result = await assignGovernanceOrgRole({
    orgRoleCode,
    employeeCode,
    departmentCode: departmentCode as string | null,
    startsOn,
    endsOn: endsOn as string | null,
    sourceDocumentCode: sourceDocumentCode as string | null,
  })
  if (result instanceof Error) return initialError(result.message)
  revalidatePath("/organization/governance/manage")
  return { ok: true, error: null }
}

export async function revokeGovernanceOrgRoleAction(
  _state: GovernanceActionState,
  formData: FormData,
): Promise<GovernanceActionState> {
  const me = await requireAuth()
  if (!me.permissions.includes("governance:manage"))
    return initialError("組織ロールを管理する権限がありません")
  const rawId = formData.get("assignment_id")
  const assignmentId = typeof rawId === "string" && /^[1-9]\d*$/.test(rawId) ? Number(rawId) : null
  if (assignmentId === null || !Number.isSafeInteger(assignmentId))
    return initialError("割当を特定できません")
  const result = await revokeGovernanceOrgRole(assignmentId)
  if (result instanceof Error) return initialError(result.message)
  revalidatePath("/organization/governance/manage")
  return { ok: true, error: null }
}

function revalidateGovernance(code: string): void {
  revalidatePath("/organization/governance")
  revalidatePath(`/organization/governance/${code}`)
  revalidatePath("/organization/governance/manage")
}

function toRequiredText(value: FormDataEntryValue | null, max: number): string | null {
  if (typeof value !== "string") return null
  const text = value.trim()
  return text.length > 0 && text.length <= max ? text : null
}

function toOptionalText(value: FormDataEntryValue | null, max: number): string | null | Error {
  if (value === null || value === "") return null
  if (typeof value !== "string") return new Error("入力値が不正です")
  const text = value.trim()
  return text.length <= max ? text || null : new Error(`${max}文字以内で入力してください`)
}

function toIsoDate(value: FormDataEntryValue | null): string | null | Error {
  if (typeof value !== "string" || value === "") return null
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : new Error("日付を正しく入力してください")
}
