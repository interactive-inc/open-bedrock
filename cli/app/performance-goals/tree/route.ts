import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"

export const help = `bedrock performance-goals tree [--period <p>]   全社→部門→個人の目標ツリー`

export default factory.createHandlers(
  zValidator("json", z.object({ help: z.string().optional(), period: z.string().optional() })),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const client = await createClient()

    const response = await client["performance-goals"].tree.$get({
      query: { period: query.period },
    })

    const tree = await response.json()

    return c.json(tree)
  },
)
