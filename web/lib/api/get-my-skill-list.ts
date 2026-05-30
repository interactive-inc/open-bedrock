import { createClient } from "@/lib/api/hc-client"

// GET /skills/me を session トークン付きで呼び、本人の登録スキル一覧を取得する。
export async function getMySkillList() {
  const client = await createClient()

  const response = await client.skills.me.$get()

  if (response.status >= 400) {
    return new Error("failed to load my skills")
  }

  return response.json()
}
