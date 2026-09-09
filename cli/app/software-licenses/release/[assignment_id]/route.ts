import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock software-licenses release <assignment-id> --reason <text>
同じ解除の再送には同じ理由を指定します。`

export default factory.createHandlers(
  zValidator(
    "json",
    z
      .object({
        help: z.string().optional(),
        reason: z.string().trim().min(1).max(1000).optional(),
      })
      .strict(),
  ),
  zValidator("param", z.object({ assignment_id: z.string().uuid().optional() })),
  async (c) => {
    const query = c.req.valid("json")
    if (query.help) return c.text(help)
    const assignmentId = c.req.valid("param").assignment_id
    if (!assignmentId || !query.reason)
      throw new UsageError("引数 <assignment-id> と --reason が必要です")
    const client = await createClient()
    const response = await client["software-license"]["software-licenses"].assignments[
      ":assignmentId"
    ].release.$post({
      param: { assignmentId },
      json: { reason: query.reason },
    })
    return c.json(await response.json())
  },
)
