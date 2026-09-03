import { createClient } from "@/lib/api/hc-client"
import { toApiResponseError } from "@/lib/api/to-api-response-error"
import type { ApiResponseError } from "@/lib/api/api-response-error"

/**
 * DELETE /system/roles/:roleId。custom System Role を削除する。
 * API が再認証 grant を要求するため、あれば `x-system-step-up` として送る。
 */
export async function deleteRole(
  roleId: string,
  stepUpToken: string | null,
): Promise<null | ApiResponseError> {
  const client = await createClient()

  const response = await client.system.roles[":roleId"].$delete(
    { param: { roleId } },
    { headers: toStepUpHeaders(stepUpToken) },
  )

  if (response.status !== 204) {
    return toApiResponseError(response, "ロールの削除に失敗しました")
  }

  return null
}

function toStepUpHeaders(stepUpToken: string | null): Record<string, string> {
  if (stepUpToken === null) {
    return {}
  }

  return { "x-system-step-up": stepUpToken }
}
