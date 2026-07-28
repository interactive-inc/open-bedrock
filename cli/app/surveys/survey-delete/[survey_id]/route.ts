import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock surveys survey-delete <id> — アンケートを削除（管理権限）`

export default factory.createHandlers(
  zValidator("json", z.object({ help: z.string().optional() })),
  zValidator("param", z.object({ survey_id: z.string().optional() })),
  async (c) => {
    if (c.req.valid("json").help) return c.text(help)

    const surveyId = c.req.valid("param").survey_id

    if (!surveyId) throw new UsageError("引数 <id> が必要です")

    const client = await createClient()

    const response = await client.surveys[":survey_id"].$delete({
      param: { survey_id: surveyId },
    })

    if (response.status !== 204) {
      throw new UsageError("アンケートの削除に失敗しました")
    }

    return c.json({ survey_id: surveyId, status: "deleted" })
  },
)
