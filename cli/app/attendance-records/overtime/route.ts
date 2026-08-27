import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"

export const help = `bedrock attendance-records overtime [--month <YYYY-MM>] [--scope <reports|all>]   時間外の参考集計（法定判定ではない）`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      month: z.string().optional(),
      scope: z.enum(["reports", "all"]).optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const client = await createClient()

    const response = await client["attendance"]["attendance-records"]["overtime-summary"].$get({
      query: { month: query.month, scope: query.scope },
    })

    return c.json(await response.json())
  },
)
