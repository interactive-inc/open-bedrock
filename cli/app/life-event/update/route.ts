import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `karte life-event update --id <id> --type <s> --date <date> [--detail <s>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      id: z.string().optional(),
      type: z.string().optional(),
      date: z.string().optional(),
      detail: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query.id || !query.type || !query.date)
      throw new UsageError("--id, --type, --date が必要です")

    const client = await createClient()

    const response = await client["life-events"][":id"].$put({
      param: { id: query.id },
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
