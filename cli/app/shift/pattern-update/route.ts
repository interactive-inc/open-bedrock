import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `karte shift pattern-update --id <pattern-id> --code <c> --name <n> --start <time> --end <time> [--break <min>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      id: z.string().optional(),
      code: z.string().optional(),
      name: z.string().optional(),
      start: z.string().optional(),
      end: z.string().optional(),
      break: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query.id || !query.code || !query.name || !query.start || !query.end) {
      throw new UsageError("--id と --code と --name と --start と --end が必要です")
    }

    const client = await createClient()

    const response = await client.shift.patterns[":id"].$put({
      param: { id: query.id },
      json: {
        code: query.code,
        name: query.name,
        start_time: query.start,
        end_time: query.end,
        break_minutes: query.break !== undefined ? Number(query.break) : undefined,
      },
    })

    const pattern = await response.json()

    return c.json(pattern)
  },
)
