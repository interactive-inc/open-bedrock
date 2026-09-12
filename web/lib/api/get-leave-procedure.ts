import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

/** 休暇の承認規程と版を取得する。 */
export async function getLeaveProcedure() {
  const client = await createClient()
  const response = await client.leave["leave-procedures"].$get()
  if (response.status >= 400)
    return toResponseError(response, { fallback: "休暇の承認規程を取得できません" })
  return response.json()
}
