import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { table } from "@/lib/render/table"
import { factory } from "@/factory"

export const help = `karte leave balance — 残日数照会`

export default factory.createHandlers(
  zValidator("json", z.object({ help: z.string().optional() })),
  async (c) => {
    if (c.req.valid("json").help) return c.text(help)

    const cols = ["leave_type", "granted_days", "used_days", "remaining_days"]

    const client = await createClient()

    const response = await client.leave.balance.me.$get()

    const rows = await response.json()

    return c.text(
      table(
        cols,
        rows.map((row) => cols.map((col) => String(row[col as keyof typeof row]))),
        `残日数 (${rows.length}件)`,
      ),
    )
  },
)
