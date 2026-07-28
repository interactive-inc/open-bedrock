import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"

export const help = `bedrock thanks list [--limit <n>] [--offset <n>] — 感謝のタイムライン`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      limit: z.string().optional(),
      offset: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const client = await createClient()

    const response = await client.thanks.$get({
      query: { limit: query.limit, offset: query.offset },
    })

    const rows = await response.json()

    return c.json(rows)
  },
)
