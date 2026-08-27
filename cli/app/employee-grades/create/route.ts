import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"
import { toFiniteNumber } from "@/lib/to-finite-number"

export const help = `bedrock employee-grades create --employee-id <id> --grade-id <id> --effective-date <YYYY-MM-DD> [--reason <r>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      "employee-id": z.string().optional(),
      "grade-id": z.string().optional(),
      "effective-date": z.string().optional(),
      reason: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query["employee-id"] || !query["grade-id"] || !query["effective-date"])
      throw new UsageError("--employee-id, --grade-id, --effective-date が必要です")

    const client = await createClient()

    const response = await client.company["employee-grades"].$post({
      json: {
        employee_id: query["employee-id"],
        grade_id: toFiniteNumber(query["grade-id"], "--grade-id"),
        effective_date: query["effective-date"],
        reason: query.reason,
      },
    })

    const data = await response.json()

    return c.json(data)
  },
)
