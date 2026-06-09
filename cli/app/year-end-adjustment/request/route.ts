import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { toFiniteNumber } from "@/lib/to-finite-number"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `karte year-end-adjustment request --year <n> [--note <s>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      year: z.string().optional(),
      note: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query.year) throw new UsageError("--year が必要です")

    const client = await createClient()

    const response = await client["year-end-adjustments"].$post({
      json: {
        target_year: toFiniteNumber(query.year, "--year"),
        note: query.note ? query.note : null,
      },
    })

    const yearEndAdjustment = await response.json()

    return c.json(yearEndAdjustment)
  },
)
