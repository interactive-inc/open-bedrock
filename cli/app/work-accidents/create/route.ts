import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock work-accidents create --occurred <date> --summary <s> [--employee-id <id>] [--location <l>] [--severity <minor|serious>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      occurred: z.string().optional(),
      summary: z.string().optional(),
      "employee-id": z.string().optional(),
      location: z.string().optional(),
      severity: z.enum(["minor", "serious"]).optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query.occurred || !query.summary) {
      throw new UsageError("--occurred と --summary が必要です")
    }

    const client = await createClient()

    const response = await client["work-accident"]["work-accidents"].$post({
      json: {
        occurred_on: query.occurred,
        summary: query.summary,
        employee_id: query["employee-id"] ?? null,
        location: query.location ?? null,
        severity: query.severity ?? null,
      },
    })

    const record = await response.json()

    return c.json(record)
  },
)
