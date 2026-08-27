import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { createClient } from "@/lib/http/hc-client"
import { readJsonFile } from "@/lib/io/read-json"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock surveys edit <response-id> --data <file> — 自分のアンケート回答を差し替え`

export default factory.createHandlers(
  zValidator("json", z.object({ help: z.string().optional(), data: z.string().optional() })),
  zValidator("param", z.object({ response_id: z.string().optional() })),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const responseId = c.req.valid("param").response_id

    if (!responseId) throw new UsageError("引数 <response-id> が必要です")

    if (!query.data) throw new UsageError("--data <file> が必要です")

    const parsed = z.record(z.string(), z.unknown()).safeParse(await readJsonFile(query.data))

    if (parsed.success === false) {
      throw new UsageError("--data の JSON はオブジェクト形式である必要があります")
    }

    const client = await createClient()

    const response = await client["survey"]["surveys"].responses[":responseId"].$put({
      param: { responseId: responseId },
      json: { answers_json: parsed.data },
    })

    const result = await response.json()

    return c.json(result)
  },
)
