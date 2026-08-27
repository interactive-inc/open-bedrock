import { createClient } from "@/lib/api/hc-client"

/**
 * DELETE /training-courses/:code。管理権限が研修コースをアーカイブする。
 * 権限不足は 403、不存在は 404 を api が返すため、戻りは Error になる。成功時は null。
 */
export async function archiveTrainingCourse(code: string): Promise<null | Error> {
  const client = await createClient()

  const response = await client["training"]["training-courses"][":code"].$delete({
    param: { code: code },
  })

  if (response.status >= 400) {
    return new Error("研修コースのアーカイブに失敗しました")
  }

  return null
}
