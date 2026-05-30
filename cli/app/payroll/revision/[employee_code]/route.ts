import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { table } from "@/lib/render/table"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `karte payroll revision <employee_code>`

export default factory.createHandlers(
  zValidator("json", z.object({ help: z.string().optional() })),
  zValidator("param", z.object({ employee_code: z.string().optional() })),
  async (c) => {
    if (c.req.valid("json").help) return c.text(help)

    const employeeCode = c.req.valid("param").employee_code

    if (!employeeCode) throw new UsageError("引数 <employee_code> が必要です")

    const client = await createClient()

    const response = await client["salary-revisions"][":employee_code"].$get({
      param: { employee_code: employeeCode },
    })

    const rows = await response.json()

    const cols = ["id", "effective_date", "previous_base_salary", "new_base_salary", "reason"]

    return c.text(
      table(
        cols,
        rows.map((row) => cols.map((col) => String(row[col as keyof typeof row]))),
        `給与改定履歴 (${rows.length}件)`,
      ),
    )
  },
)
