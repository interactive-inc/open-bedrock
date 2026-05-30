import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { pretty } from "@/lib/render/table"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `karte expense show <id>`

export default factory.createHandlers(
  zValidator("json", z.object({ help: z.string().optional() }).passthrough()),
  zValidator("param", z.object({ expense_id: z.string().optional() })),
  async (c) => {
    if (c.req.valid("json").help) return c.text(help)

    const expenseId = c.req.valid("param").expense_id

    if (!expenseId) throw new UsageError("引数 <id> が必要です")

    const client = await createClient()

    const response = await client.expenses[":id"].$get({
      param: { id: expenseId },
    })

    return c.text(pretty(await response.json()))
  },
)
