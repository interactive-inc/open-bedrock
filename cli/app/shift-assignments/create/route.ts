import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock shift-assignments create --employee-code <c> --date <date> --pattern-code <c> [--note <n>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      "employee-code": z.string().optional(),
      date: z.string().optional(),
      "pattern-code": z.string().optional(),
      note: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query["employee-code"] || !query.date || !query["pattern-code"]) {
      throw new UsageError("--employee-code と --date と --pattern-code が必要です")
    }

    const client = await createClient()

    const response = await client["shift-assignments"].$post({
      json: {
        employee_code: query["employee-code"],
        date: query.date,
        pattern_code: query["pattern-code"],
        note: query.note,
      },
    })

    const assignment = await response.json()

    return c.json(assignment)
  },
)
