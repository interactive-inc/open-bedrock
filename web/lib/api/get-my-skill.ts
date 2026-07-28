import { createClient } from "@/lib/api/hc-client"

/** GET /employee-skills/me/:skill_code を session トークン付きで呼び、本人の登録スキルを1件取得する。 */
export async function getMySkill(skillCode: string) {
  const client = await createClient()

  const response = await client["employee-skills"].me[":skill_code"].$get({
    param: { skill_code: skillCode },
  })

  if (response.status >= 400) {
    return new Error("failed to load my skill")
  }

  return response.json()
}
