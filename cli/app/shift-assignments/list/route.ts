import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"

export const help = `bedrock shift-assignments list [--from <date>] [--to <date>] [--department-code <c>] — シフト割当一覧`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      from: z.string().optional(),
      to: z.string().optional(),
      "department-code": z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const client = await createClient()

    const response = await client["shift"]["shift-assignments"].$get({
      query: {
        from: query.from,
        to: query.to,
        dept_code: query["department-code"],
      },
    })

    const rows = await response.json()

    return c.json(rows)
  },
)
