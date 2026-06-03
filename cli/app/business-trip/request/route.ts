import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `karte business-trip request --destination <s> --start <date> --end <date> --purpose <s> [--cost <n>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      destination: z.string().optional(),
      start: z.string().optional(),
      end: z.string().optional(),
      purpose: z.string().optional(),
      cost: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query.destination || !query.start || !query.end || !query.purpose)
      throw new UsageError("--destination, --start, --end, --purpose が必要です")

    const client = await createClient()

    const response = await client["business-trips"].$post({
      json: {
        destination: query.destination,
        start_date: query.start,
        end_date: query.end,
        purpose: query.purpose,
        estimated_cost: query.cost ? Number(query.cost) : null,
      },
    })

    const businessTrip = await response.json()

    return c.json(businessTrip)
  },
)
