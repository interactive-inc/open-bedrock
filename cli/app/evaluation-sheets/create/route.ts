import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"
import { toFiniteNumber } from "@/lib/to-finite-number"

export const help = `bedrock evaluation-sheets create --employee-id <id> --period <p> [--template-id <id>] [--primary-evaluator-id <id>] [--secondary-evaluator-id <id>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      "employee-id": z.string().optional(),
      period: z.string().optional(),
      "template-id": z.string().optional(),
      "primary-evaluator-id": z.string().optional(),
      "secondary-evaluator-id": z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query["employee-id"]) throw new UsageError("--employee-id が必要です")

    if (!query.period) throw new UsageError("--period が必要です")

    const client = await createClient()

    const response = await client["performance-review"]["evaluation-sheets"].$post({
      json: {
        employee_id: query["employee-id"],
        period: query.period,
        template_id: query["template-id"]
          ? toFiniteNumber(query["template-id"], "--template-id")
          : undefined,
        primary_evaluator_id: query["primary-evaluator-id"],
        secondary_evaluator_id: query["secondary-evaluator-id"],
      },
    })

    const sheet = await response.json()

    return c.json(sheet)
  },
)
