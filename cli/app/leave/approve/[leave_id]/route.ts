import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock leave approve <id> [--comment <c>]`

export default factory.createHandlers(
  zValidator("json", z.object({ help: z.string().optional(), comment: z.string().optional() })),
  zValidator("param", z.object({ leave_id: z.string().optional() })),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const leaveId = c.req.valid("param").leave_id

    if (!leaveId) throw new UsageError("引数 <id> が必要です")

    const client = await createClient()

    const response = await client.leave.requests[":id"].approve.$post({
      param: { id: leaveId },
      json: { comment: query.comment ?? null },
    })

    const result = await response.json()

    return c.text(`approved id=${leaveId} status=${result.status}`)
  },
)
