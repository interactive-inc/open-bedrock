import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock life-event request --type <s> --date <date> [--detail <s>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      type: z.string().optional(),
      date: z.string().optional(),
      detail: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query.type || !query.date) throw new UsageError("--type, --date が必要です")

    const client = await createClient()

    const response = await client["life-events"].$post({
      json: {
        event_type: query.type,
        event_date: query.date,
        detail: query.detail ?? null,
      },
    })

    const lifeEvent = await response.json()

    return c.json(lifeEvent)
  },
)
