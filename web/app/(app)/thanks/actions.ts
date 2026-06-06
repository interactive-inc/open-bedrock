"use server"

import { revalidatePath } from "next/cache"
import { createReward } from "@/lib/api/create-reward"
import { getMe } from "@/lib/api/get-me"
import { requestRedemption } from "@/lib/api/request-redemption"
import { sendThanks } from "@/lib/api/send-thanks"
import { canManageRewards } from "@/lib/thanks/can-manage-rewards"

// useActionState で参照する共通の戻り値。ok=成功 / error=表示するエラー文言。
export type ThanksActionState = {
  ok: boolean
  error: string | null
}

// 感謝送付 Server Action。recipient_employee_code と message が必須、points は任意。
// 送り手は token から解決される。成功時は /thanks を revalidate してタイムラインへ反映する。
export async function sendThanksAction(
  previousState: ThanksActionState,
  formData: FormData,
): Promise<ThanksActionState> {
  const recipientEmployeeCode = formData.get("recipient_employee_code")

  if (typeof recipientEmployeeCode !== "string" || recipientEmployeeCode === "") {
    return { ok: false, error: "送り先の従業員コードを入力してください" }
  }

  const message = formData.get("message")

  if (typeof message !== "string" || message.trim() === "") {
    return { ok: false, error: "感謝のメッセージを入力してください" }
  }

  const points = toPoints(formData.get("points"))

  if (points instanceof Error) {
    return { ok: false, error: points.message }
  }

  const sent = await sendThanks({
    recipient_employee_code: recipientEmployeeCode,
    message,
    points,
  })

  if (sent instanceof Error) {
    return { ok: false, error: "感謝の送付に失敗しました" }
  }

  revalidatePath("/thanks")

  return { ok: true, error: null }
}

// 交換申請 Server Action。reward_id が必須。成功時は /thanks を revalidate して残高へ反映する。
export async function requestRedemptionAction(
  previousState: ThanksActionState,
  formData: FormData,
): Promise<ThanksActionState> {
  const rawRewardId = formData.get("reward_id")

  const rewardId = typeof rawRewardId === "string" ? Number(rawRewardId) : Number.NaN

  if (Number.isInteger(rewardId) === false || rewardId <= 0) {
    return { ok: false, error: "交換する景品を選択してください" }
  }

  const requested = await requestRedemption(rewardId)

  if (requested instanceof Error) {
    return { ok: false, error: "交換の申請に失敗しました（残高不足または在庫切れ）" }
  }

  revalidatePath("/thanks")

  return { ok: true, error: null }
}

// 景品登録 Server Action（管理権限向け）。name と point_cost が必須、stock は任意。
// UI 側でも非表示にするが、Server Action は直接呼べるため getMe のロールで二重に弾く（defense-in-depth）。
export async function createRewardAction(
  previousState: ThanksActionState,
  formData: FormData,
): Promise<ThanksActionState> {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canManageRewards(currentUser.role) === false) {
    return { ok: false, error: "景品を登録する権限がありません" }
  }

  const name = formData.get("name")

  if (typeof name !== "string" || name.trim() === "") {
    return { ok: false, error: "景品名を入力してください" }
  }

  const pointCost = toPositiveInt(formData.get("point_cost"))

  if (pointCost instanceof Error) {
    return { ok: false, error: pointCost.message }
  }

  const stock = toStock(formData.get("stock"))

  if (stock instanceof Error) {
    return { ok: false, error: stock.message }
  }

  const created = await createReward({ name, point_cost: pointCost, stock })

  if (created instanceof Error) {
    return { ok: false, error: "景品の登録に失敗しました" }
  }

  revalidatePath("/thanks")

  return { ok: true, error: null }
}

// 交換コストを正の整数に変換する。
function toPositiveInt(raw: FormDataEntryValue | null): number | Error {
  const parsed = typeof raw === "string" ? Number(raw) : Number.NaN

  if (Number.isInteger(parsed) === false || parsed <= 0) {
    return new Error("交換コストは正の整数で入力してください")
  }

  return parsed
}

// 在庫を 0 以上の整数 or null に変換する。空欄は null（在庫無制限）。
function toStock(raw: FormDataEntryValue | null): number | null | Error {
  if (typeof raw !== "string" || raw.trim() === "") {
    return null
  }

  const parsed = Number(raw)

  if (Number.isInteger(parsed) === false || parsed < 0) {
    return new Error("在庫は 0 以上の整数で入力してください")
  }

  return parsed
}

// フォームのポイント入力を 0 以上の整数 or null に変換する。空欄は null（ポイント無し）。
function toPoints(raw: FormDataEntryValue | null): number | null | Error {
  if (typeof raw !== "string" || raw.trim() === "") {
    return null
  }

  const parsed = Number(raw)

  if (Number.isInteger(parsed) === false || parsed < 0) {
    return new Error("ポイントは 0 以上の整数で入力してください")
  }

  return parsed
}
