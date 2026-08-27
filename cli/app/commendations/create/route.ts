import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock commendations create --employee-id <id> --title <t> --reason <r> --awarded-on <d>`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      "employee-id": z.string().optional(),
      title: z.string().optional(),
      reason: z.string().optional(),
      "awarded-on": z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const awardedOn = query["awarded-on"]

    if (!query["employee-id"] || !query.title || !query.reason || !awardedOn)
      throw new UsageError("--employee-id, --title, --reason, --awarded-on が必要です")

    const client = await createClient()

    const response = await client["commendation"]["commendations"].$post({
      json: {
        employee_id: query["employee-id"],
        title: query.title,
        reason: query.reason,
        awarded_on: awardedOn,
      },
    })

    return c.json(await response.json())
  },
)
