import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock recruitment-candidates advance <candidate_id> --stage screening|interview|offer|hired|rejected`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      stage: z.enum(["screening", "interview", "offer", "hired", "rejected"]).optional(),
    }),
  ),
  zValidator("param", z.object({ id: z.string().optional() })),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const id = c.req.valid("param").id

    if (!id) throw new UsageError("引数 <candidate_id> が必要です")

    if (!query.stage) throw new UsageError("--stage が必要です")

    const client = await createClient()

    const response = await client["recruitment"]["recruitment-candidates"][":id"].advance.$post({
      param: { id },
      json: { stage: query.stage },
    })

    return c.json(await response.json())
  },
)
