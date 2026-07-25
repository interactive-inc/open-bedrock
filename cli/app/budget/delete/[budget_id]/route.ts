import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock budget delete <id>`

export default factory.createHandlers(
  zValidator("json", z.object({ help: z.string().optional() }).passthrough()),
  zValidator("param", z.object({ budget_id: z.string().optional() })),
  async (c) => {
    if (c.req.valid("json").help) return c.text(help)

    const budgetId = c.req.valid("param").budget_id

    if (!budgetId) throw new UsageError("引数 <id> が必要です")

    const client = await createClient()

    const response = await client.budgets[":id"].$delete({
      param: { id: budgetId },
    })

    if (response.status !== 204) {
      throw new UsageError("予算の削除に失敗しました")
    }

    return c.json({ id: budgetId, status: "deleted" })
  },
)
