import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock rooms availability --start <iso> --end <iso> [--capacity <n>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      start: z.string().optional(),
      end: z.string().optional(),
      capacity: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query.start || !query.end) throw new UsageError("--start と --end が必要です")

    const client = await createClient()

    const response = await client.rooms.availability.$get({
      query: {
        start_at: query.start,
        end_at: query.end,
        capacity: query.capacity ?? "0",
      },
    })

    const rows = await response.json()

    return c.json(rows)
  },
)
