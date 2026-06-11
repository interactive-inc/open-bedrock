import { createClient } from "@/lib/api/hc-client"
import type { SkillSearchQuery } from "@/lib/api/types/skill-types"

// GET /skills を session トークン付きで呼び、スキル一覧を取得する。
// 検索語 q とカテゴリ category は null のとき送信されない。
export async function getSkillList(query: SkillSearchQuery) {
  const client = await createClient()

  const response = await client.skills.$get({
    query: { q: query.q ?? undefined, category: query.category ?? undefined },
  })

  if (response.status >= 400) {
    return new Error("failed to load skills")
  }

  const body = await response.json()

  return body.data
}
