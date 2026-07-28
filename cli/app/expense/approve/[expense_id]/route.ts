import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock expense approve <id> [--comment <c>]`

export default factory.createHandlers(
  zValidator("json", z.object({ help: z.string().optional() }).passthrough()),
  zValidator("param", z.object({ expense_id: z.string().optional() })),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const expenseId = c.req.valid("param").expense_id

    if (!expenseId) throw new UsageError("引数 <id> が必要です")

    const comment = query.comment as string | undefined

    const client = await createClient()

    const response = await client.expenses[":id"].approve.$post({
      param: { id: expenseId },
      json: { comment: comment ?? null },
    })

    const result = await response.json()

    return c.text(`approved id=${expenseId} status=${result.status}`)
  },
)
