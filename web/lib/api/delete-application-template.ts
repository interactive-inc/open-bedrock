import { createClient } from "@/lib/api/hc-client"

// DELETE /templates/:code。管理権限が申請テンプレートを削除する。
// 権限不足は 403、不存在は 404 を api が返すため、戻りは Error になる。成功時は null。
export async function deleteApplicationTemplate(code: string): Promise<null | Error> {
  const client = await createClient()

  const response = await client.templates[":code"].$delete({
    param: { code: code },
  })

  if (response.status >= 400) {
    return new Error("failed to delete application template")
  }

  return null
}
