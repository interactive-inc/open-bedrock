import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { toFiniteNumber } from "@/lib/to-finite-number"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock grades assign --employee-id <id> --grade-id <id> --effective-date <YYYY-MM-DD> [--reason <r>] [--review-cycle-id <id>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      "employee-id": z.string().optional(),
      "grade-id": z.string().optional(),
      "effective-date": z.string().optional(),
      reason: z.string().optional(),
      "review-cycle-id": z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query["employee-id"] || !query["grade-id"] || !query["effective-date"])
      throw new UsageError("--employee-id, --grade-id, --effective-date が必要です")

    const reviewCycleId = query["review-cycle-id"]

    const client = await createClient()

    const response = await client.grades.assignments.$post({
      json: {
        employee_id: toFiniteNumber(query["employee-id"], "--employee-id"),
        grade_id: toFiniteNumber(query["grade-id"], "--grade-id"),
        effective_date: query["effective-date"],
        reason: query.reason ?? null,
        review_cycle_id:
          reviewCycleId === undefined ? null : toFiniteNumber(reviewCycleId, "--review-cycle-id"),
      },
    })

    const data = await response.json()

    return c.json(data)
  },
)
