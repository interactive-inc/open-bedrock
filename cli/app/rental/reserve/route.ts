import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `karte rental reserve --item <name> --start <date> --end <date> [--purpose <p>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      item: z.string().optional(),
      start: z.string().optional(),
      end: z.string().optional(),
      purpose: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query.item || !query.start || !query.end)
      throw new UsageError("--item, --start, --end が必要です")

    const client = await createClient()

    const response = await client.rentals.$post({
      json: {
        item_name: query.item,
        start_date: query.start,
        end_date: query.end,
        purpose: query.purpose ?? null,
      },
    })

    const reservation = await response.json()

    return c.json(reservation)
  },
)
