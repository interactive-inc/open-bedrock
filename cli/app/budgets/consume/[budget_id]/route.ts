import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"
import { toFiniteNumber } from "@/lib/to-finite-number"

export const help = `karte budgets consume <id> --amount <n> --recorded-on <d> [--note <t>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      amount: z.string().optional(),
      "recorded-on": z.string().optional(),
      note: z.string().optional(),
    }),
  ),
  zValidator("param", z.object({ budget_id: z.string().optional() })),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const budgetId = c.req.valid("param").budget_id

    if (!budgetId) throw new UsageError("引数 <id> が必要です")

    if (!query.amount || !query["recorded-on"])
      throw new UsageError("--amount と --recorded-on が必要です")

    const amount = toFiniteNumber(query.amount, "--amount")

    const client = await createClient()

    const response = await client.budgets[":id"].consumptions.$post({
      param: { id: budgetId },
      json: {
        amount: amount,
        recorded_on: query["recorded-on"],
        note: query.note,
      },
    })

    return c.json(await response.json())
  },
)
