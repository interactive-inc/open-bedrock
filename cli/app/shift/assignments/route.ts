import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"

export const help = `karte shift assignments [--from <date>] [--to <date>] [--department-code <c>] [--employee-code <c>] — シフト割当一覧`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      from: z.string().optional(),
      to: z.string().optional(),
      "department-code": z.string().optional(),
      "employee-code": z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const client = await createClient()

    const response = await client.shift.assignments.$get({
      query: {
        from: query.from,
        to: query.to,
        department_code: query["department-code"],
        employee_code: query["employee-code"],
      },
    })

    const rows = await response.json()

    return c.json(rows)
  },
)
