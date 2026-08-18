import { createClient } from "@/lib/api/hc-client"

/** GET /employee-skills/me/:skillCode を session トークン付きで呼び、本人の登録スキルを1件取得する。 */
export async function getMySkill(skillCode: string) {
  const client = await createClient()

  const response = await client["employee-skills"].me[":skillCode"].$get({
    param: { skillCode: skillCode },
  })

  if (response.status >= 400) {
    return new Error("failed to load my skill")
  }

  return response.json()
}
