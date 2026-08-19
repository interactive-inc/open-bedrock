import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock surveys response <response-id> — 自分のアンケート回答を1件表示`

export default factory.createHandlers(
  zValidator("json", z.object({ help: z.string().optional() })),
  zValidator("param", z.object({ response_id: z.string().optional() })),
  async (c) => {
    if (c.req.valid("json").help) return c.text(help)

    const responseId = c.req.valid("param").response_id

    if (!responseId) throw new UsageError("引数 <response-id> が必要です")

    const client = await createClient()

    const response = await client.surveys.responses[":responseId"].$get({
      param: { responseId: responseId },
    })

    const result = await response.json()

    return c.json(result)
  },
)
