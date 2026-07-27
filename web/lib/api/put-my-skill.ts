import { createClient } from "@/lib/api/hc-client"
import type { SetSkillRequest } from "@/lib/api/types/skill-types"

/**
 * PUT /employee-skills/me を session トークン付きで呼び、本人のスキルを登録/更新する。
 * 成功時は upsert 後の EmployeeSkillResponse を返す。
 */
export async function putMySkill(body: SetSkillRequest) {
  const client = await createClient()

  const response = await client["employee-skills"].me.$put({ json: body })

  if (response.status >= 400) {
    return new Error("failed to update my skill")
  }

  return response.json()
}
