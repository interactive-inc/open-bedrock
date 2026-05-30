import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { table } from "@/lib/render/table"
import { factory } from "@/factory"

export const help = `karte notify list [--unread]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      unread: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const client = await createClient()

    const response = await client.notifications.me.$get({
      query: { is_read: query.unread ? "false" : undefined },
    })

    const rows = await response.json()

    const cols = ["id", "kind", "title", "is_read", "created_at"]

    return c.text(
      table(
        cols,
        rows.map((row) => cols.map((col) => String(row[col as keyof typeof row] ?? ""))),
        `通知一覧 (${rows.length}件)`,
      ),
    )
  },
)
