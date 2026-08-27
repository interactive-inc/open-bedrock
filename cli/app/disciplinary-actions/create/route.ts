import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock disciplinary-actions create --employee-id <id> --kind <k> --summary <s> --decided-on <d>`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      "employee-id": z.string().optional(),
      kind: z.string().optional(),
      summary: z.string().optional(),
      "decided-on": z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const decidedOn = query["decided-on"]

    if (!query["employee-id"] || !query.kind || !query.summary || !decidedOn)
      throw new UsageError("--employee-id, --kind, --summary, --decided-on が必要です")

    const client = await createClient()

    const response = await client["disciplinary-action"]["disciplinary-actions"].$post({
      json: {
        employee_id: query["employee-id"],
        kind: query.kind,
        summary: query.summary,
        decided_on: decidedOn,
      },
    })

    return c.json(await response.json())
  },
)
