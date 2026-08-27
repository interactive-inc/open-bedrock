import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { toFiniteNumber } from "@/lib/to-finite-number"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock certification-definitions record-add --employee-id <id> --certification-id <id> --acquired <date> [--expires <date>] [--note <n>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      "employee-id": z.string().optional(),
      "certification-id": z.string().optional(),
      acquired: z.string().optional(),
      expires: z.string().optional(),
      note: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query["employee-id"] || !query["certification-id"] || !query.acquired) {
      throw new UsageError("--employee-id と --certification-id と --acquired が必要です")
    }

    const client = await createClient()

    const response = await client["certification"]["employee-certifications"].$post({
      json: {
        employee_id: query["employee-id"],
        certification_id: toFiniteNumber(query["certification-id"], "--certification-id"),
        acquired_on: query.acquired,
        expires_on: query.expires ?? null,
        note: query.note ?? null,
      },
    })

    const record = await response.json()

    return c.json(record)
  },
)
