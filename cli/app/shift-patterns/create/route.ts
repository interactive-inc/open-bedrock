import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { toFiniteNumber } from "@/lib/to-finite-number"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock shift-patterns create --code <c> --name <n> --start <time> --end <time> [--break <min>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
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

    if (!query.code || !query.name || !query.start || !query.end) {
      throw new UsageError("--code と --name と --start と --end が必要です")
    }

    const client = await createClient()

    const response = await client["shift-patterns"].$post({
      json: {
        code: query.code,
        name: query.name,
        start_time: query.start,
        end_time: query.end,
        break_minutes:
          query.break !== undefined ? toFiniteNumber(query.break, "--break") : undefined,
      },
    })

    const pattern = await response.json()

    return c.json(pattern)
  },
)
