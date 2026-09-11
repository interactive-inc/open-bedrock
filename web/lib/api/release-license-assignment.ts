import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

/** 元の利用記録を残したまま解除理由を記録する。 */
export async function releaseLicenseAssignment(assignmentId: string, reason: string) {
  const client = await createClient()
  const response = await client["software-license"]["software-licenses"].assignments[
    ":assignmentId"
  ].release.$post({
    param: { assignmentId },
    json: { reason },
  })
  if (!response.ok) return toResponseError(response, { fallback: "利用解除を記録できませんでした" })
  return response.json()
}
