import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock family-care-leaves update --id <id> --kind <s> --start <date> --end <date> [--note <s>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      id: z.string().optional(),
      kind: z.string().optional(),
      start: z.string().optional(),
      end: z.string().optional(),
      note: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query.id || !query.kind || !query.start || !query.end)
      throw new UsageError("--id, --kind, --start, --end が必要です")

    const client = await createClient()

    const response = await client["family-care-leaves"][":id"].$put({
      param: { id: query.id },
      json: {
        leave_kind: query.kind,
        start_date: query.start,
        end_date: query.end,
        note: query.note ?? null,
      },
    })

    const familyCareLeave = await response.json()

    return c.json(familyCareLeave)
  },
)
