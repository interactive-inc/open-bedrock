import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock shift assignment-update --id <assignment-id> --date <yyyy-mm-dd> [--pattern <code>] [--note <text>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      id: z.string().optional(),
      date: z.string().optional(),
      pattern: z.string().optional(),
      note: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query.id || !query.date) throw new UsageError("--id, --date が必要です")

    const client = await createClient()

    const response = await client.shift.assignments[":id"].$put({
      param: { id: query.id },
      json: {
        pattern_code: query.pattern ?? null,
        date: query.date,
        note: query.note ?? null,
      },
    })

    const assignment = await response.json()

    return c.json(assignment)
  },
)
