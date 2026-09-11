import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"

export const help = `bedrock knowledge-articles history --id <id> [--limit <1-100>] [--offset <0-100000>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      id: z
        .string()
        .regex(/^[1-9]\d*$/)
        .optional(),
      limit: z
        .string()
        .regex(/^\d+$/)
        .refine((value) => Number(value) >= 1 && Number(value) <= 100)
        .optional(),
      offset: z
        .string()
        .regex(/^\d+$/)
        .refine((value) => Number(value) <= 100000)
        .optional(),
    }),
  ),
  async (c) => {
    const input = c.req.valid("json")
    if (input.help) return c.text(help)
    if (!input.id) return c.json({ error: "--id が必要です" }, 400)
    const client = await createClient()
    const response = await client.knowledge["knowledge-articles"][":id"].revisions.$get({
      param: { id: input.id },
      query: { limit: input.limit ?? "20", offset: input.offset ?? "0" },
    })
    return c.json(await response.json())
  },
)
