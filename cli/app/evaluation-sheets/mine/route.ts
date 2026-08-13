import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"

export const help = `bedrock evaluation-sheets mine [--period <p>] [--status <s>]   自分の評価シート一覧`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      period: z.string().optional(),
      status: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const client = await createClient()

    const response = await client["evaluation-sheets"].me.$get({
      query: {
        period: query.period,
        status: query.status,
      },
    })

    const rows = await response.json()

    return c.json(rows)
  },
)
