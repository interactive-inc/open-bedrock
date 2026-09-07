import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"
import type { ApplicationWorkflow } from "@/lib/api/types/application-workflow-types"

/** 確認した版に稟議の承認規程を保存する。 */
export async function publishRingiProcedure(
  workflow: ApplicationWorkflow,
  expectedRevision: number,
) {
  const client = await createClient()
  const response = await client.ringi["ringi-procedures"].$put({
    json: { expected_revision: expectedRevision, workflow },
  })
  if (response.status >= 400)
    return toResponseError(response, { fallback: "承認規程を保存できません" })
  return response.json()
}
