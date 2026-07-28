import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock company-calendar-days add --date <YYYY-MM-DD> --kind <holiday|workday> [--name <n>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      date: z.string().optional(),
      kind: z.enum(["holiday", "workday"]).optional(),
      name: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query.date || !query.kind)
      throw new UsageError("--date, --kind (holiday|workday) が必要です")

    const client = await createClient()

    const response = await client["company-calendar-days"].$post({
      json: {
        calendar_date: query.date,
        kind: query.kind,
        name: query.name ?? null,
      },
    })

    return c.json(await response.json())
  },
)
