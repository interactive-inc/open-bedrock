import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

// DELETE /employees/:code。従業員を台帳から削除する（権限が必要、自分自身は不可）。
// 権限不足は 403、不存在は 404、自分自身の削除は 409 を api が返すため、戻りは Error になる。成功時は null。
export async function deleteEmployee(code: string): Promise<null | Error> {
  const client = await createClient()

  const response = await client.employees[":code"].$delete({ param: { code } })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "従業員の削除に失敗しました",
      conflictMessages: {
        "cannot delete your own account": "自分自身のアカウントは削除できません",
      },
    })
  }

  return null
}
