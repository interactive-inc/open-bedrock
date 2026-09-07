"use server"

import { toRingiDecisionTarget } from "@/lib/ringi/to-ringi-decision-target"
import { cancelRingi } from "@/lib/api/cancel-ringi"
import { executeRingi } from "@/lib/api/execute-ringi"
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

  const requestKey = formData.get("request_key")
  if (typeof requestKey !== "string" || requestKey.length === 0)
    return { ok: false, error: "提出の識別子がありません。画面を読み直してください" }
  const created = await submitRingi({
    request_key: requestKey,
    existing_ringi_id: toPositiveIntId(formData.get("existing_ringi_id")),
    previous_ringi_id: toPositiveIntId(formData.get("previous_ringi_id")),
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

  const target = toRingiDecisionTarget(formData.get("decision_target"))
  if (target instanceof Error) return { ok: false, error: target.message }
  const decided = await approveRingi(ringiId, comment, target)

  if (decided instanceof Error) {
    return { ok: false, error: decided.message }
  }

  revalidatePath("/inbox/ringis")

  revalidatePath("/my/ringis")

  revalidatePath(`/my/ringis/${ringiId}`)

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

  const target = toRingiDecisionTarget(formData.get("decision_target"))
  if (target instanceof Error) return { ok: false, error: target.message }
  const decided = await rejectRingi(ringiId, comment, target)

  if (decided instanceof Error) {
    return { ok: false, error: decided.message }
  }

  revalidatePath("/inbox/ringis")

  revalidatePath("/my/ringis")

  revalidatePath(`/my/ringis/${ringiId}`)

  return { ok: true, error: null }
}

/** 表示した稟議の取消または承認済み決裁の確定を行う。 */
export async function advanceRingiAction(
  _previous: RingiDecisionFormState,
  formData: FormData,
): Promise<RingiDecisionFormState> {
  const id = toPositiveIntId(formData.get("ringi_id"))
  const target = toRingiDecisionTarget(formData.get("decision_target"))
  if (id === null || target instanceof Error)
    return { ok: false, error: "稟議の判断対象を確認してください" }
  const operation = formData.get("operation")
  if (operation === "cancel") {
    const result = await cancelRingi(id, target)
    if (result instanceof Error) return { ok: false, error: result.message }
  } else if (operation === "execute") {
    const result = await executeRingi(id, target)
    if (result instanceof Error) return { ok: false, error: result.message }
  } else return { ok: false, error: "稟議の操作が不正です" }
  revalidatePath(`/my/ringis/${id}`)
  revalidatePath("/my/ringis")
  revalidatePath("/inbox/ringis")
  return { ok: true, error: null }
}
