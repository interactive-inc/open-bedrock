import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"
import type { ApplicationWorkflow } from "@/lib/api/types/application-workflow-types"

export async function updateApplicationWorkflow(code: string, workflow: ApplicationWorkflow) {
  const client = await createClient()
  const response = await client["application-templates"][":code"].workflow.$put({
    param: { code },
    json: workflow,
  })
  if (response.status >= 400) {
    return toResponseError(response, { fallback: "承認フローの保存に失敗しました" })
  }
  return response.json()
}
