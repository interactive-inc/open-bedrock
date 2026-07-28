import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"

export const help = `bedrock skill-definitions list [--q <kw>] [--category <c>]`

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

    const client = await createClient()

    const response = await client["skill-definitions"].$get({
      query: { q: query.q, category: query.category },
    })

    const rows = await response.json()

    return c.json(rows)
  },
)
