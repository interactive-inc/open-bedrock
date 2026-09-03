"use server"

import { revalidatePath } from "next/cache"
import { approveRingi } from "@/lib/api/approve-ringi"
import { rejectRingi } from "@/lib/api/reject-ringi"
import { submitRingi } from "@/lib/api/submit-ringi"
import { toPositiveIntId } from "@/lib/form/to-positive-int-id"
import { toRequiredText } from "@/lib/form/to-required-text"

export type RingiSubmitFormState = {
  ok: boolean
  error: string | null
}

export type RingiDecisionFormState = {
  ok: boolean
  error: string | null
}

/** 稟議起案の Server Action。useActionState から呼ばれる。 */
export async function submitRingiAction(
  previousState: RingiSubmitFormState,
  formData: FormData,
): Promise<RingiSubmitFormState> {
  const approverId = toRequiredText(formData.get("approver_id"), {
    label: "承認者",
    max: 128,
  })

  if (approverId instanceof Error) {
    return { ok: false, error: approverId.message }
  }

  const titleValue = formData.get("title")

  const title = typeof titleValue === "string" ? titleValue : ""

  if (title === "") {
    return { ok: false, error: "件名を入力してください" }
  }

  const amountValue = formData.get("amount")

  const amount = Number(amountValue)

  if (!Number.isFinite(amount) || !Number.isInteger(amount) || amount <= 0) {
    return { ok: false, error: "金額は正の整数で入力してください" }
  }

  const reasonValue = formData.get("reason")

  const reason = typeof reasonValue === "string" ? reasonValue : ""

  if (reason === "") {
    return { ok: false, error: "理由を入力してください" }
  }

  const created = await submitRingi({
    approver_id: approverId,
    title: title,
    amount: amount,
    reason: reason,
  })

  if (created instanceof Error) {
    return { ok: false, error: created.message }
  }

  revalidatePath("/my/ringis")

  revalidatePath("/inbox/ringis")

  return { ok: true, error: null }
}

/**
 * 稟議承認の Server Action。ringi_id は hidden フィールドから受け取る。
 * 承認者本人かどうかの判定は api 側の権限判定に委ね、ここでは事前チェックしない。
 */
export async function approveRingiAction(
  previousState: RingiDecisionFormState,
  formData: FormData,
): Promise<RingiDecisionFormState> {
  const ringiId = toPositiveIntId(formData.get("ringi_id"))

  if (ringiId === null) {
    return { ok: false, error: "稟議が不正です" }
  }

  const commentValue = formData.get("comment")

  const comment = typeof commentValue === "string" && commentValue !== "" ? commentValue : null

  const decided = await approveRingi(ringiId, comment)

  if (decided instanceof Error) {
    return { ok: false, error: decided.message }
  }

  revalidatePath("/inbox/ringis")

  revalidatePath("/my/ringis")

  return { ok: true, error: null }
}

/**
 * 稟議却下の Server Action。ringi_id は hidden フィールドから受け取る。
 * 承認者本人かどうかの判定は api 側の権限判定に委ね、ここでは事前チェックしない。
 */
export async function rejectRingiAction(
  previousState: RingiDecisionFormState,
  formData: FormData,
): Promise<RingiDecisionFormState> {
  const ringiId = toPositiveIntId(formData.get("ringi_id"))

  if (ringiId === null) {
    return { ok: false, error: "稟議が不正です" }
  }

  const commentValue = formData.get("comment")

  const comment = typeof commentValue === "string" && commentValue !== "" ? commentValue : null

  const decided = await rejectRingi(ringiId, comment)

  if (decided instanceof Error) {
    return { ok: false, error: decided.message }
  }

  revalidatePath("/inbox/ringis")

  revalidatePath("/my/ringis")

  return { ok: true, error: null }
}
