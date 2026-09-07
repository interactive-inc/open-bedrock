import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"

export const help = `bedrock expenses inbox [--limit <n>] [--offset <n>] — 承認待ち一覧`

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
    if (c.req.valid("json").help) return c.text(help)

    const client = await createClient()

    const response = await client["expense"]["expenses"].inbox.$get({
      query: { limit: c.req.valid("json").limit, offset: c.req.valid("json").offset },
    })

    const rows = await response.json()

    return c.json(rows)
  },
)
