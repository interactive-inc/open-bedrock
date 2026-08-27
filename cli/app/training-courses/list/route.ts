import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"

export const help = `bedrock training-courses list [--category <c>] [--status <s>] — 研修コース一覧`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      category: z.string().optional(),
      status: z.enum(["active", "archived"]).optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const client = await createClient()

    const response = await client["training"]["training-courses"].$get({
      query: { category: query.category, status: query.status },
    })

    const rows = await response.json()

    return c.json(rows)
  },
)
