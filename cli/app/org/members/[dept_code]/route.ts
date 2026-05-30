import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { table } from "@/lib/render/table"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `karte org members <dept_code> — 部署メンバー`

export default factory.createHandlers(
  zValidator("json", z.object({ help: z.string().optional() })),
  zValidator("param", z.object({ dept_code: z.string().optional() })),
  async (c) => {
    if (c.req.valid("json").help) return c.text(help)

    const deptCode = c.req.valid("param").dept_code

    if (!deptCode) throw new UsageError("引数 <dept_code> が必要です")

    const cols = ["employee_code", "employee_name", "position", "is_manager"]

    const client = await createClient()

    const response = await client.org.departments[":code"].members.$get({
      param: { code: deptCode },
    })

    const rows = await response.json()

    return c.text(
      table(
        cols,
        rows.map((row) => cols.map((col) => String(row[col as keyof typeof row]))),
        `${deptCode} のメンバー (${rows.length}件)`,
      ),
    )
  },
)
