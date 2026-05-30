import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { table } from "@/lib/render/table"
import { factory } from "@/factory"

export const help = `karte kb search [q] [--category <c>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      category: z.string().optional(),
    }),
  ),
  // 位置引数 q は任意。`kb search リモート` のように渡される場合は param で受ける。
  zValidator("param", z.object({ q: z.string().optional() })),
  async (c) => {
    const json = c.req.valid("json")

    if (json.help) return c.text(help)

    const q = c.req.valid("param").q

    const query: Record<string, string> = {}

    if (q) query.q = decodeURIComponent(q)

    if (json.category) query.category = json.category

    const cols = ["id", "category", "title", "snippet"]

    const client = await createClient()

    const response = await client.knowledge.$get({ query })

    const rows = await response.json()

    return c.text(
      table(
        cols,
        rows.map((row) => [
          String(row.id),
          String(row.category),
          String(row.title),
          String(row.snippet ?? "").slice(0, 60),
        ]),
        `ナレッジ検索 (${rows.length}件)`,
      ),
    )
  },
)
