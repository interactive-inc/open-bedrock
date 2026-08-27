import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"

export const help = `bedrock attendance-records me [--from <d>] [--to <d>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      from: z.string().optional(),
      to: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const client = await createClient()

    const response = await client["attendance"]["attendance-records"].me.$get({
      query: { from: query.from, to: query.to },
    })

    const rows = await response.json()

    return c.json(rows)
  },
)
