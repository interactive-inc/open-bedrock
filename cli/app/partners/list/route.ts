import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"

export const help = `bedrock partners list [--q <keyword>] [--status active|archived]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      q: z.string().optional(),
      status: z.enum(["active", "archived"]).optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const client = await createClient()

    const response = await client["partner"]["partners"].$get({
      query: { q: query.q, status: query.status },
    })

    return c.json(await response.json())
  },
)
