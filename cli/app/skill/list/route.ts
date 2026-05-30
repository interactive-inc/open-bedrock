import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { table } from "@/lib/render/table"
import { factory } from "@/factory"

export const help = `karte skill list [--q <kw>] [--category <c>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      q: z.string().optional(),
      category: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const cols = ["code", "name", "category"]

    const client = await createClient()

    const response = await client.skills.$get({
      query: { q: query.q, category: query.category },
    })

    const rows = await response.json()

    return c.text(
      table(
        cols,
        rows.map((row) => cols.map((col) => String(row[col as keyof typeof row]))),
        `スキル一覧 (${rows.length}件)`,
      ),
    )
  },
)
