import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { table } from "@/lib/render/table"
import { factory } from "@/factory"

export const help = `karte attendance me [--from <d>] [--to <d>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      from: z.string().optional(),
      to: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const client = await createClient()

    const response = await client.attendance.me.$get({
      query: { from: query.from, to: query.to },
    })

    const rows = await response.json()

    const cols = ["id", "work_date", "clock_in_at", "clock_out_at", "work_minutes", "status"]

    return c.text(
      table(
        cols,
        rows.map((row) => cols.map((col) => String(row[col as keyof typeof row]))),
        `勤怠（自分）(${rows.length}件)`,
      ),
    )
  },
)
