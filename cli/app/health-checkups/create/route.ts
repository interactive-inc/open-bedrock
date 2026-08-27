import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { toFiniteNumber } from "@/lib/to-finite-number"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock health-checkups create --employee-id <id> --fiscal-year <y> --kind <regular|stress_check> [--status <scheduled|completed|declined>] [--conducted <date>] [--note <n>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      "employee-id": z.string().optional(),
      "fiscal-year": z.string().optional(),
      kind: z.enum(["regular", "stress_check"]).optional(),
      status: z.enum(["scheduled", "completed", "declined"]).optional(),
      conducted: z.string().optional(),
      note: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query["employee-id"] || !query["fiscal-year"] || !query.kind) {
      throw new UsageError("--employee-id と --fiscal-year と --kind が必要です")
    }

    const client = await createClient()

    const response = await client["health-checkup"]["health-checkups"].$post({
      json: {
        employee_id: query["employee-id"],
        fiscal_year: toFiniteNumber(query["fiscal-year"], "--fiscal-year"),
        checkup_kind: query.kind,
        status: query.status,
        conducted_on: query.conducted ?? null,
        note: query.note ?? null,
      },
    })

    const record = await response.json()

    return c.json(record)
  },
)
