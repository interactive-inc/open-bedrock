import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `karte resignation request --date <date> [--last <date>] [--reason <s>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      date: z.string().optional(),
      last: z.string().optional(),
      reason: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query.date) throw new UsageError("--date が必要です")

    const client = await createClient()

    const response = await client.resignations.$post({
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
