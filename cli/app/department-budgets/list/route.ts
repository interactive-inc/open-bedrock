import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"

export const help = `bedrock department-budgets list [--department-id <n>] [--fiscal-period <p>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      "department-id": z.string().optional(),
      "fiscal-period": z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const client = await createClient()

    const response = await client["department-budgets"].$get({
      query: {
        department_id: query["department-id"],
        fiscal_period: query["fiscal-period"],
      },
    })

    return c.json(await response.json())
  },
)
