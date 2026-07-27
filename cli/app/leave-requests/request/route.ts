import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock leave-requests request --type annual|special --start <date> --end <date> [--reason <text>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      type: z.enum(["annual", "special"]).optional(),
      start: z.string().optional(),
      end: z.string().optional(),
      reason: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query.type) throw new UsageError("--type が必要です (annual|special)")

    if (!query.start || !query.end) throw new UsageError("--start と --end が必要です")

    const client = await createClient()

    const response = await client["leave-requests"].$post({
      json: {
        leave_type: query.type,
        start_date: query.start,
        end_date: query.end,
        reason: query.reason ?? null,
      },
    })

    const created = await response.json()

    return c.json(created)
  },
)
