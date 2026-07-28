import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"
import { toFiniteNumber } from "@/lib/to-finite-number"

export const help = `bedrock headcount-plans create --fiscal-year <y> --planned-count <n> [--department-code <c>] [--note <t>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      "fiscal-year": z.string().optional(),
      "planned-count": z.string().optional(),
      "department-code": z.string().optional(),
      note: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query["fiscal-year"] || !query["planned-count"])
      throw new UsageError("--fiscal-year と --planned-count が必要です")

    const fiscalYear = toFiniteNumber(query["fiscal-year"], "--fiscal-year")

    const plannedCount = toFiniteNumber(query["planned-count"], "--planned-count")

    const client = await createClient()

    const response = await client["headcount-plans"].$post({
      json: {
        fiscal_year: fiscalYear,
        planned_count: plannedCount,
        department_code: query["department-code"] ?? null,
        note: query.note ?? null,
      },
    })

    return c.json(await response.json())
  },
)
