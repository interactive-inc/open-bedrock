import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { table } from "@/lib/render/table"
import { factory } from "@/factory"

export const help = `karte leave inbox — 承認待ち一覧（承認者のみ）`

export default factory.createHandlers(
  zValidator("json", z.object({ help: z.string().optional() })),
  async (c) => {
    if (c.req.valid("json").help) return c.text(help)

    const cols = ["id", "applicant_name", "leave_type", "start_date", "end_date", "days", "status"]

    const client = await createClient()

    const response = await client.leave.requests.inbox.$get()

    const rows = await response.json()

    return c.text(
      table(
        cols,
        rows.map((row) => cols.map((col) => String(row[col as keyof typeof row]))),
        `承認待ち (${rows.length}件)`,
      ),
    )
  },
)
