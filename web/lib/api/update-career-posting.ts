import { createClient } from "@/lib/api/hc-client"
import type { CareerPosting, CareerPostingUpdateRequest } from "@/lib/api/types/career-types"

// PUT /career/postings/:posting_id。管理ロールが公募の内容と状態を変更する。
// 権限不足は 403、不存在は 404 を api が返すため、戻りは Error になる。
export async function updateCareerPosting(
  postingId: number,
  request: CareerPostingUpdateRequest,
): Promise<CareerPosting | Error> {
  const client = await createClient()

  const response = await client.career.postings[":posting_id"].$put({
    param: { posting_id: String(postingId) },
    json: {
      title: request.title,
      dept_id: request.dept_id ?? undefined,
      dept_name: request.dept_name ?? undefined,
      required_skills: request.required_skills ?? undefined,
      status: request.status,
    },
  })

  if (response.status >= 400) {
    return new Error("社内公募の変更に失敗しました")
  }

  return response.json()
}
