import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"
import { parseRingiDecisionTarget } from "@/lib/ringi/parse-ringi-decision-target"

export const help = `bedrock ringi-requests reject <id> --decision-target '<json>' [--comment <c>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      "decision-target": z.string().optional(),
      comment: z.string().optional(),
    }),
  ),
  zValidator("param", z.object({ ringi_id: z.string().optional() })),
  async (c) => {
    const query = c.req.valid("json")
    if (query.help) return c.text(help)
    const id = c.req.valid("param").ringi_id
    if (!id) throw new UsageError("引数 <id> が必要です")
    const target = parseRingiDecisionTarget(query["decision-target"])
    const client = await createClient()
    const response = await client.ringi["ringi-requests"][":id"].reject.$post({
      param: { id },
      json: { decision_target: target, comment: query.comment ?? null },
    })
    return c.json(await response.json())
  },
)
