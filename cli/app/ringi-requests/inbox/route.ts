import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"

export const help = `bedrock ringi-requests inbox — 承認待ち一覧`

export default factory.createHandlers(
  zValidator("json", z.object({ help: z.string().optional() }).passthrough()),
  async (c) => {
    if (c.req.valid("json").help) return c.text(help)

    const client = await createClient()

    const response = await client["ringi-requests"].inbox.$get()

    const rows = await response.json()

    return c.json(rows)
  },
)
