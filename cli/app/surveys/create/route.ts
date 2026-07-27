import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { toQuestionsJson } from "@/lib/survey/questions-json"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock surveys create --title <t> [--status open|closed] [--questions <file>] — アンケートを作成（管理権限）`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      title: z.string().optional(),
      status: z.string().optional(),
      questions: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query.title) throw new UsageError("--title が必要です")

    const status = query.status ?? "open"

    if (status !== "open" && status !== "closed") {
      throw new UsageError("--status は open か closed を指定してください")
    }

    const questionsJson = await toQuestionsJson(query.questions)

    const client = await createClient()

    const response = await client.surveys.$post({
      json: { title: query.title, status: status, questions_json: [...questionsJson] },
    })

    if (response.status !== 201) {
      throw new UsageError("アンケートの作成に失敗しました")
    }

    return c.json(await response.json())
  },
)
