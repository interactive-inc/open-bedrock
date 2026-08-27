import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"

export const help = `bedrock onboarding-assignments me — 自分のオンボーディングタスク`

export default factory.createHandlers(
  zValidator("json", z.object({ help: z.string().optional() })),
  async (c) => {
    if (c.req.valid("json").help) return c.text(help)

    const client = await createClient()

    const response = await client["onboarding"]["onboarding-assignments"].me.$get()

    const rows = await response.json()

    return c.json(rows)
  },
)
