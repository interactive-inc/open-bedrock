"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { assignLicense } from "@/lib/api/assign-license"
import { releaseLicenseAssignment } from "@/lib/api/release-license-assignment"
import type { LicenseActionState } from "@/app/(app)/software-license/licenses/actions"

const assignmentInput = z.object({
  license_id: z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  id: z.string().uuid(),
  employee_id: z.string().trim().min(1),
  account_reference: z.string().trim().max(300),
  reason: z.string().trim().min(1).max(1000),
})

/** 認証済みAPIに利用開始の記録を委ね、再送時も同じ記録IDを使う。 */
export async function assignLicenseAction(
  previousState: LicenseActionState,
  form: FormData,
): Promise<LicenseActionState> {
  const input = assignmentInput.safeParse(Object.fromEntries(form))
  if (!input.success)
    return { ok: false, error: "職員と理由を入力してください。理由は1000文字以内です" }
  const command = input.data
  const recorded = await assignLicense(command.license_id, {
    id: command.id,
    employee_id: command.employee_id,
    account_reference: command.account_reference || null,
    reason: command.reason,
  })
  if (recorded instanceof Error) return { ok: false, error: recorded.message }
  revalidatePath(`/software-license/licenses/${command.license_id}`)
  return { ok: true, error: null }
}

/** APIが返した契約の利用一覧を更新し、解除履歴を残す。 */
export async function releaseLicenseAssignmentAction(
  previousState: LicenseActionState,
  form: FormData,
): Promise<LicenseActionState> {
  const input = z
    .object({
      id: z.string().uuid(),
      reason: z.string().trim().min(1).max(1000),
    })
    .safeParse(Object.fromEntries(form))
  if (!input.success) return { ok: false, error: "解除理由を1000文字以内で入力してください" }
  const released = await releaseLicenseAssignment(input.data.id, input.data.reason)
  if (released instanceof Error) return { ok: false, error: released.message }
  revalidatePath(`/software-license/licenses/${released.license_id}`)
  return { ok: true, error: null }
}
