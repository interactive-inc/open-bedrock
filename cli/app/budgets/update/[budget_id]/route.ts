import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"
import { toFiniteNumber } from "@/lib/to-finite-number"

export const help = `karte budgets update <id> --fiscal-year <y> --title <t> --amount <n> [--department-code <c>] [--note <t>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      "fiscal-year": z.string().optional(),
      title: z.string().optional(),
      amount: z.string().optional(),
      "department-code": z.string().optional(),
      note: z.string().optional(),
    }),
  ),
  zValidator("param", z.object({ budget_id: z.string().optional() })),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const budgetId = c.req.valid("param").budget_id

    if (!budgetId) throw new UsageError("引数 <id> が必要です")

    if (!query["fiscal-year"] || !query.title || !query.amount)
      throw new UsageError("--fiscal-year と --title と --amount が必要です")

    const fiscalYear = toFiniteNumber(query["fiscal-year"], "--fiscal-year")

    const amount = toFiniteNumber(query.amount, "--amount")

    const client = await createClient()

    const response = await client.budgets[":id"].$put({
      param: { id: budgetId },
      json: {
        fiscal_year: fiscalYear,
        title: query.title,
        amount: amount,
        department_code: query["department-code"],
        note: query.note,
      },
    })

    return c.json(await response.json())
  },
)
