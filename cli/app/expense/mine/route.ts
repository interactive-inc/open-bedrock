import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { table } from "@/lib/render/table"
import { factory } from "@/factory"

export const help = `karte expense mine [--status <s>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      status: z.enum(["pending", "approved", "rejected", "settled"]).optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const cols = ["id", "category", "amount", "spent_at", "status", "created_at"]

    const client = await createClient()

    const response = await client.expenses.me.$get({
      query: { status: query.status },
    })

    const rows = await response.json()

    return c.text(
      table(
        cols,
        rows.map((row) => cols.map((col) => String(row[col as keyof typeof row]))),
        `自分の経費 (${rows.length}件)`,
      ),
    )
  },
)
