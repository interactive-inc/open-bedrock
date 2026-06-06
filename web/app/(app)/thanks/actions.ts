"use server"

import { revalidatePath } from "next/cache"
import { sendThanks } from "@/lib/api/send-thanks"

// useActionState で参照する共通の戻り値。ok=成功 / error=表示するエラー文言。
export type ThanksActionState = {
  ok: boolean
  error: string | null
}

// 感謝送付 Server Action。recipient_employee_code と message が必須。
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

  const sent = await sendThanks({
    recipient_employee_code: recipientEmployeeCode,
    message,
  })

  if (sent instanceof Error) {
    return { ok: false, error: "感謝の送付に失敗しました" }
  }

  revalidatePath("/thanks")

  return { ok: true, error: null }
}
