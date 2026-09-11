import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"

export const help = `bedrock leave-requests inbox — 判断・確定待ち一覧（承認者のみ）[--limit <件数> --offset <位置>]`

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

    const response = await client["leave"]["leave-requests"].inbox.$get({
      query: { limit: c.req.valid("json").limit, offset: c.req.valid("json").offset },
    })

    const rows = await response.json()

    return c.json(rows)
  },
)
