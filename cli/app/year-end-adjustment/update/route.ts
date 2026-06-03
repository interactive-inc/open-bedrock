import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `karte year-end-adjustment update --id <id> --year <n> [--note <s>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      id: z.string().optional(),
      year: z.string().optional(),
      note: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query.id || !query.year) throw new UsageError("--id, --year が必要です")

    const client = await createClient()

    const response = await client["year-end-adjustments"][":id"].$put({
      param: { id: query.id },
      json: {
        target_year: Number(query.year),
        note: query.note ? query.note : null,
      },
    })

    const yearEndAdjustment = await response.json()

    return c.json(yearEndAdjustment)
  },
)
