import { createClient } from "@/lib/api/hc-client"
import type { CareerPosting } from "@/lib/api/types/career-types"

// GET /career/postings/:posting_id。管理ロールが公募を1件取得する。
// 権限不足は 403、不存在は 404 を api が返すため、戻りは Error になる。
export async function getCareerPosting(postingId: number): Promise<CareerPosting | Error> {
  const client = await createClient()

  const response = await client.career.postings[":posting_id"].$get({
    param: { posting_id: String(postingId) },
  })

  if (response.status >= 400) {
    return new Error("failed to load career posting")
  }

  return response.json()
}
