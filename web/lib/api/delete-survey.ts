import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

/**
 * DELETE /surveys/:survey_id。アンケートを削除する（管理者ロールのみ）。
 * 権限不足は 403、不存在は 404 を api が返すため、戻りは Error になる。成功時は null。
 */
export async function deleteSurvey(id: number): Promise<null | Error> {
  const client = await createClient()

  const response = await client.surveys[":survey_id"].$delete({
    param: { survey_id: String(id) },
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "アンケートの削除に失敗しました",
      conflictMessages: {
        "open survey cannot be deleted": "公開中のアンケートは削除できません",
        "survey was modified concurrently": "アンケートが他の操作で更新されたため削除できません",
      },
    })
  }

  return null
}
