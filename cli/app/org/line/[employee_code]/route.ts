import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { table } from "@/lib/render/table"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `karte org line <employee_code> — レポートライン（上位）`

export default factory.createHandlers(
  zValidator("json", z.object({ help: z.string().optional() })),
  zValidator("param", z.object({ employee_code: z.string().optional() })),
  async (c) => {
    if (c.req.valid("json").help) return c.text(help)

    const employeeCode = c.req.valid("param").employee_code

    if (!employeeCode) throw new UsageError("引数 <employee_code> が必要です")

    const cols = ["depth", "employee_code", "employee_name", "position"]

    const client = await createClient()

    const response = await client.org["reporting-line"][":employee_code"].$get({
      param: { employee_code: employeeCode },
    })

    const rows = await response.json()

    return c.text(
      table(
        cols,
        rows.map((row) => cols.map((col) => String(row[col as keyof typeof row]))),
        `${employeeCode} のレポートライン (${rows.length}件)`,
      ),
    )
  },
)
