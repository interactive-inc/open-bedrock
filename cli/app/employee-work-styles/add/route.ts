import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { toFiniteNumber } from "@/lib/to-finite-number"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock employee-work-styles add --employee-id <id> --style <regular|flextime|discretionary|shift> --starts-on <YYYY-MM-DD> [--ends-on <d>] [--note <n>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      "employee-id": z.string().optional(),
      style: z.enum(["regular", "flextime", "discretionary", "shift"]).optional(),
      "starts-on": z.string().optional(),
      "ends-on": z.string().optional(),
      note: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query["employee-id"] || !query.style || !query["starts-on"])
      throw new UsageError("--employee-id, --style, --starts-on が必要です")

    const client = await createClient()

    const response = await client["employee-work-styles"].$post({
      json: {
        employee_id: toFiniteNumber(query["employee-id"], "--employee-id"),
        style: query.style,
        starts_on: query["starts-on"],
        ends_on: query["ends-on"] ?? null,
        note: query.note ?? null,
      },
    })

    return c.json(await response.json())
  },
)
