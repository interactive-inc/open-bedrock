import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"

export const help = `bedrock software-licenses list [--status active|cancelled] [--limit 1..100] [--offset 0..100000]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      status: z.enum(["active", "cancelled"]).optional(),
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
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const client = await createClient()

    const response = await client["software-license"]["software-licenses"].$get({
      query: { status: query.status, limit: query.limit, offset: query.offset },
    })

    return c.json(await response.json())
  },
)
