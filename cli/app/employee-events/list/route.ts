import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"

export const help = `bedrock employee-events list [--employee-id <id>] [--kind <k>]   (employee-id は数値の社員 ID)`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      "employee-id": z.string().optional(),
      kind: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const client = await createClient()

    const response = await client["employee-events"].$get({
      query: { employee_id: query["employee-id"], kind: query.kind },
    })

    const rows = await response.json()

    return c.json(rows)
  },
)
