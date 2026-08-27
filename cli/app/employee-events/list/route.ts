import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock employee-events list --employee-code <code> [--kind <k>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      "employee-code": z.string().optional(),
      kind: z.enum(["join", "transfer", "leave_of_absence", "return", "retire"]).optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)
    if (!query["employee-code"]) throw new UsageError("--employee-code が必要です")

    const client = await createClient()

    const response = await client.company["employee-events"].$get({
      query: { employee_code: query["employee-code"], kind: query.kind },
    })

    const rows = await response.json()

    return c.json(rows)
  },
)
