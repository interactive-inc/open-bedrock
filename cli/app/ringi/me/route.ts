import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"

export const help = `karte ringi me [--status <s>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      status: z.enum(["pending", "approved", "rejected"]).optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const client = await createClient()

    const response = await client.ringi.me.$get({
      query: { status: query.status },
    })

    const rows = await response.json()

    return c.json(rows)
  },
)
