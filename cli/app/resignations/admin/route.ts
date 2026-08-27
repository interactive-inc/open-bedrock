import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"

export const help = `bedrock resignations admin [--employee-id <id>] [--status <s>] [--limit <n>] [--offset <n>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      employee_id: z.string().optional(),
      status: z.string().optional(),
      limit: z.string().optional(),
      offset: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const client = await createClient()

    const response = await client["resignation"]["resignations"].admin.$get({
      query: {
        employee_id: query.employee_id,
        status: query.status,
        limit: query.limit,
        offset: query.offset,
      },
    })

    const resignations = await response.json()

    return c.json(resignations)
  },
)
