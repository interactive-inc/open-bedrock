import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"

export const help = `karte budgets list [--fiscal-year <y>] [--department-code <c>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      "fiscal-year": z.string().optional(),
      "department-code": z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const client = await createClient()

    const response = await client.budgets.$get({
      query: {
        fiscal_year: query["fiscal-year"],
        department_code: query["department-code"],
      },
    })

    return c.json(await response.json())
  },
)
