import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

/** 休暇の確認内容と判断履歴、現在の操作資格を取得する。 */
export async function getLeaveProcedureRequest(id: number) {
  const client = await createClient()
  const response = await client.leave["leave-requests"][":id"].procedure.$get({
    param: { id: String(id) },
  })
  if (response.status >= 400)
    return toResponseError(response, { fallback: "休暇の承認案件を取得できません" })
  return response.json()
}
