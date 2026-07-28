import { factory } from "@/factory"
import { createClient } from "@/lib/http/hc-client"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

export const help = `bedrock batch employee-lifecycle process-outbox [--limit <n>]`
export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      limit: z.coerce.number().int().min(1).max(100).optional(),
    }),
  ),
  async (c) => {
    const input = c.req.valid("json")
    if (input.help) return c.text(help)
    const client = await createClient()
    const response = await client.batch["employee-lifecycle"]["process-outbox"].$post({
      json: { limit: input.limit },
    })
    return c.json(await response.json())
  },
)
