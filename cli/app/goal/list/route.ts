import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"

export const help = `karte goal list [--period <p>] [--employee-id <id>]   (employee-id は数値の社員 ID)`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      period: z.string().optional(),
      "employee-id": z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const client = await createClient()

    const response = await client.goals.$get({
      query: { period: query.period, employee_id: query["employee-id"] },
    })

    const rows = await response.json()

    return c.json(rows)
  },
)
