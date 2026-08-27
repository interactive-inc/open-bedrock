import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock expenses reject <id> --comment <c>`

export default factory.createHandlers(
  zValidator("json", z.object({ help: z.string().optional() }).passthrough()),
  zValidator("param", z.object({ expense_id: z.string().optional() })),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const expenseId = c.req.valid("param").expense_id

    if (!expenseId) throw new UsageError("引数 <id> が必要です")

    if (!query.comment) throw new UsageError("--comment が必要です")

    const client = await createClient()

    const response = await client["expense"]["expenses"][":id"].reject.$post({
      param: { id: expenseId },
      json: { comment: query.comment as string },
    })

    const result = await response.json()

    return c.text(`rejected id=${expenseId} status=${result.status}`)
  },
)
