import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock resignation update --id <id> --date <date> [--last <date>] [--reason <s>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      id: z.string().optional(),
      date: z.string().optional(),
      last: z.string().optional(),
      reason: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query.id || !query.date) throw new UsageError("--id, --date が必要です")

    const client = await createClient()

    const response = await client.resignations[":id"].$put({
      param: { id: query.id },
      json: {
        resignation_date: query.date,
        last_working_date: query.last ?? null,
        reason: query.reason ?? null,
      },
    })

    const resignation = await response.json()

    return c.json(resignation)
  },
)
