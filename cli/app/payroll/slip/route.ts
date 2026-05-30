import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { table } from "@/lib/render/table"
import { factory } from "@/factory"

export const help = `karte payroll slip [--period <YYYY-MM>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      period: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const client = await createClient()

    const response = await client.payslips.me.$get({
      query: { period: query.period },
    })

    const rows = await response.json()

    const cols = ["id", "period", "base_salary", "allowances", "deductions", "net_pay", "status"]

    return c.text(
      table(
        cols,
        rows.map((row) => cols.map((col) => String(row[col as keyof typeof row]))),
        `給与明細一覧 (${rows.length}件)`,
      ),
    )
  },
)
