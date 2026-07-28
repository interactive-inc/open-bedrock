import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { createClient } from "@/lib/http/hc-client"
import { toFiniteNumber } from "@/lib/to-finite-number"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock budget update <id> --amount <n> --name <s> [--note <m>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      amount: z.string().optional(),
      name: z.string().optional(),
      note: z.string().optional(),
    }),
  ),
  zValidator("param", z.object({ budget_id: z.string().optional() })),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const budgetId = c.req.valid("param").budget_id

    if (!budgetId) throw new UsageError("引数 <id> が必要です")

    const amount = query.amount

    const name = query.name

    if (!amount || !name) throw new UsageError("--amount と --name が必要です")

    const client = await createClient()

    const response = await client.budgets[":id"].$patch({
      param: { id: budgetId },
      json: {
        amount: toFiniteNumber(amount, "--amount"),
        name,
        note: query.note ?? null,
      },
    })

    return c.json(await response.json())
  },
)
