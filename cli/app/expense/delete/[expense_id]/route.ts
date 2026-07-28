import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock expense delete <id>`

export default factory.createHandlers(
  zValidator("json", z.object({ help: z.string().optional() }).passthrough()),
  zValidator("param", z.object({ expense_id: z.string().optional() })),
  async (c) => {
    if (c.req.valid("json").help) return c.text(help)

    const expenseId = c.req.valid("param").expense_id

    if (!expenseId) throw new UsageError("引数 <id> が必要です")

    const client = await createClient()

    const response = await client.expenses[":id"].$delete({
      param: { id: expenseId },
    })

    if (response.status !== 204) {
      throw new UsageError("経費の取り下げに失敗しました")
    }

    return c.json({ id: expenseId, status: "deleted" })
  },
)
