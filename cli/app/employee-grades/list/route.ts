import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock employee-grades list --employee-code <code>`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      "employee-code": z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)
    if (!query["employee-code"]) throw new UsageError("--employee-code が必要です")

    const client = await createClient()

    const response = await client.company["employee-grades"].$get({
      query: { employee_code: query["employee-code"] },
    })

    const rows = await response.json()

    return c.json(rows)
  },
)
