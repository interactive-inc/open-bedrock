import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"

export const help = `bedrock thanks-redemptions list [--inbox] — 交換申請一覧（--inbox は承認待ち・承認者向け）`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      inbox: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const client = await createClient()

    const response =
      query.inbox === undefined
        ? await client["thanks-redemptions"].me.$get()
        : await client["thanks-redemptions"].inbox.$get()

    return c.json(await response.json())
  },
)
