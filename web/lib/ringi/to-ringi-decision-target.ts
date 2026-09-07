import { z } from "zod"

/** フォームが表示時から保持した判断対象を検証する。 */
export function toRingiDecisionTarget(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return new Error("判断対象がありません。画面を読み直してください")
  try {
    const parsed = z
      .object({
        proposal_version: z.number().int().positive(),
        proposal_digest: z.string().regex(/^[a-f0-9]{64}$/),
        task_key: z.string().min(1).max(100),
        task_round: z.number().int().positive(),
      })
      .strict()
      .safeParse(JSON.parse(value))
    return parsed.success ? parsed.data : new Error("判断対象が不正です。画面を読み直してください")
  } catch {
    return new Error("判断対象が不正です。画面を読み直してください")
  }
}
