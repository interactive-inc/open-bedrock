import { createClient } from "@/lib/api/hc-client"

/**
 * DELETE /skills/me/:skill_code。本人の登録スキルを削除する。
 * 未登録のコードは api が 404 を返すため、戻りは Error になる。成功時は null。
 */
export async function deleteMySkill(skillCode: string): Promise<null | Error> {
  const client = await createClient()

  const response = await client.skills.me[":skill_code"].$delete({
    param: { skill_code: skillCode },
  })

  if (response.status >= 400) {
    return new Error("failed to delete my skill")
  }

  return null
}
