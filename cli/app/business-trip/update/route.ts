import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { createClient } from "@/lib/http/hc-client"
import { toFiniteNumber } from "@/lib/to-finite-number"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock business-trip update --id <id> --destination <s> --start <date> --end <date> --purpose <s> [--cost <n>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      id: z.string().optional(),
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

    if (!query.id || !query.destination || !query.start || !query.end || !query.purpose)
      throw new UsageError("--id, --destination, --start, --end, --purpose が必要です")

    const client = await createClient()

    const response = await client["business-trips"][":id"].$put({
      param: { id: query.id },
      json: {
        destination: query.destination,
        start_date: query.start,
        end_date: query.end,
        purpose: query.purpose,
        estimated_cost: query.cost ? toFiniteNumber(query.cost, "--cost") : null,
      },
    })

    const businessTrip = await response.json()

    return c.json(businessTrip)
  },
)
