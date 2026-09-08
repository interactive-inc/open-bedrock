import { z } from "zod"
import { UsageError } from "@/lib/errors"

/** showまたはinboxで確認した内容を受け取り、送信直前に別の内容へ差し替えない。 */
export function parseLeaveDecisionTarget(value: string | undefined) {
  if (value === undefined)
    throw new UsageError("--decision-target にshowまたはinboxで確認したJSONを指定してください")
  try {
    return z
      .object({
        request_id: z.number().int().positive(),
        request_digest: z.string().regex(/^[a-f0-9]{64}$/),
      })
      .strict()
      .parse(JSON.parse(value))
  } catch {
    throw new UsageError("--decision-target が不正です")
  }
}
