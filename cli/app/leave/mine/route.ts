import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { table } from "@/lib/render/table"
import { factory } from "@/factory"

export const help = `karte leave mine [--status <s>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      status: z.enum(["pending", "approved", "rejected"]).optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const cols = ["id", "leave_type", "start_date", "end_date", "days", "status"]

    const client = await createClient()

    const response = await client.leave.requests.me.$get({
      query: { status: query.status },
    })

    const rows = await response.json()

    return c.text(
      table(
        cols,
        rows.map((row) => cols.map((col) => String(row[col as keyof typeof row]))),
        `休暇申請一覧 (${rows.length}件)`,
      ),
    )
  },
)
