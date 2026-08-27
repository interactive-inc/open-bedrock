import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"

export const help = `bedrock thanks-point-budgets me — 当月の贈与原資（付与・贈与済み・残量）`

export default factory.createHandlers(
  zValidator("json", z.object({ help: z.string().optional() })),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const client = await createClient()

    const response = await client["thanks"]["thanks-point-budgets"].me.$get()

    return c.json(await response.json())
  },
)
