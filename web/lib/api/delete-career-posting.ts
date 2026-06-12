import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

// DELETE /career/postings/:posting_id。管理ロールが公募を削除する。
// 権限不足は 403、不存在は 404 を api が返すため、戻りは Error になる。成功時は null。
export async function deleteCareerPosting(postingId: number): Promise<null | Error> {
  const client = await createClient()

  const response = await client.career.postings[":posting_id"].$delete({
    param: { posting_id: String(postingId) },
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "社内公募の削除に失敗しました",
      conflictMessages: {
        "cannot delete a posting with pending applications":
          "選考中の応募がある公募は削除できません",
      },
    })
  }

  return null
}
