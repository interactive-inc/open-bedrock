import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { table } from "@/lib/render/table"
import { factory } from "@/factory"

export const help = `karte goal list [--period <p>] [--employee-id <n>]`

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

    const cols = ["id", "period", "title", "status", "weight"]

    return c.text(
      table(
        cols,
        rows.map((row) => [
          String(row.id),
          String(row.period),
          String(row.title).slice(0, 30),
          String(row.status),
          String(row.weight),
        ]),
        `目標一覧 (${rows.length}件)`,
      ),
    )
  },
)
