import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"
import { toFiniteNumber } from "@/lib/to-finite-number"

export const help = `karte budgets create --fiscal-year <y> --title <t> --amount <n> [--department-code <c>] [--note <t>]`

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
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query["fiscal-year"] || !query.title || !query.amount)
      throw new UsageError("--fiscal-year と --title と --amount が必要です")

    const fiscalYear = toFiniteNumber(query["fiscal-year"], "--fiscal-year")

    const amount = toFiniteNumber(query.amount, "--amount")

    const client = await createClient()

    const response = await client.budgets.$post({
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
