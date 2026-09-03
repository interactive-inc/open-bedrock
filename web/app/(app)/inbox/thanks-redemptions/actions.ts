"use server"

import { revalidatePath } from "next/cache"
import { decideThanksRedemption } from "@/lib/api/decide-thanks-redemption"
import { getMe } from "@/lib/api/get-me"
import { toPositiveIntId } from "@/lib/form/to-positive-int-id"

export type RedemptionDecisionState = { ok: boolean; error: string | null }

export async function decideRedemptionAction(
  _previousState: RedemptionDecisionState,
  formData: FormData,
): Promise<RedemptionDecisionState> {
  const currentUser = await getMe()

  if (
    currentUser instanceof Error ||
    currentUser.permissions.includes("thanks_redemption:approve") === false
  ) {
    return { ok: false, error: "交換申請を承認・却下する権限がありません" }
  }

  const redemptionId = toPositiveIntId(formData.get("redemption_id"))

  if (redemptionId === null) {
    return { ok: false, error: "交換申請を特定できませんでした" }
  }

  const decision = formData.get("decision")

  if (decision !== "approve" && decision !== "reject") {
    return { ok: false, error: "操作が不正です" }
  }

  const result = await decideThanksRedemption(redemptionId, decision)

  if (result instanceof Error) {
    return { ok: false, error: result.message }
  }

  revalidatePath("/inbox/thanks-redemptions")
  revalidatePath("/thanks/thanks-redemptions")
  revalidatePath("/thanks/thanks")

  return { ok: true, error: null }
}
