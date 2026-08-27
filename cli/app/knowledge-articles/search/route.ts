import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"

export const help = `bedrock knowledge-articles search [q] [--category <c>]`

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

    const client = await createClient()

    const response = await client["knowledge"]["knowledge-articles"].$get({ query })

    const rows = await response.json()

    return c.json(rows)
  },
)
