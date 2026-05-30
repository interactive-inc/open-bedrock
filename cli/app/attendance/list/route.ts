import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { table } from "@/lib/render/table"
import { factory } from "@/factory"

export const help = `karte attendance list [--employee-id <n>] [--from <d>] [--to <d>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      "employee-id": z.string().optional(),
      from: z.string().optional(),
      to: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const client = await createClient()

    const response = await client.attendance.$get({
      query: { employee_id: query["employee-id"], from: query.from, to: query.to },
    })

    const rows = await response.json()

    const cols = [
      "id",
      "employee_id",
      "work_date",
      "clock_in_at",
      "clock_out_at",
      "overtime_minutes",
      "status",
    ]

    return c.text(
      table(
        cols,
        rows.map((row) => cols.map((col) => String(row[col as keyof typeof row]))),
        `勤怠一覧 (${rows.length}件)`,
      ),
    )
  },
)
