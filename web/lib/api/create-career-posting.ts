import { createClient } from "@/lib/api/hc-client"
import type { CareerPosting, CareerPostingCreateRequest } from "@/lib/api/types/career-types"

/**
 * POST /career/postings。管理ロールが社内公募を作成する。
 * 権限不足は 403 を api が返すため、戻りは Error になる。
 */
export async function createCareerPosting(
  request: CareerPostingCreateRequest,
): Promise<CareerPosting | Error> {
  const client = await createClient()

  const response = await client.career.postings.$post({
    json: {
      title: request.title,
      dept_id: request.dept_id ?? undefined,
      dept_name: request.dept_name ?? undefined,
      required_skills: request.required_skills ?? undefined,
      status: request.status,
    },
  })

  if (response.status >= 400) {
    return new Error("社内公募の作成に失敗しました")
  }

  return response.json()
}
