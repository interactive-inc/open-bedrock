import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock department-budgets show <id>`

export default factory.createHandlers(
  zValidator("json", z.object({ help: z.string().optional() }).passthrough()),
  zValidator("param", z.object({ budget_id: z.string().optional() })),
  async (c) => {
    if (c.req.valid("json").help) return c.text(help)

    const budgetId = c.req.valid("param").budget_id

    if (!budgetId) throw new UsageError("引数 <id> が必要です")

    const client = await createClient()

    const response = await client["expense"]["department-budgets"][":id"].$get({
      param: { id: budgetId },
    })

    return c.json(await response.json())
  },
)
