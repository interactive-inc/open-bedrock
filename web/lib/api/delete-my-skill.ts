import { createClient } from "@/lib/api/hc-client"

/**
 * DELETE /employee-skills/me/:skillCode。本人の登録スキルを削除する。
 * 未登録のコードは api が 404 を返すため、戻りは Error になる。成功時は null。
 */
export async function deleteMySkill(skillCode: string): Promise<null | Error> {
  const client = await createClient()

  const response = await client["employee-skills"].me[":skillCode"].$delete({
    param: { skillCode: skillCode },
  })

  if (response.status >= 400) {
    return new Error("failed to delete my skill")
  }

  return null
}
