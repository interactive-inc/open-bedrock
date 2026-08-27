import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"

export const help = `bedrock health-checkups [--fiscal-year <y>] [--employee-id <id>] — 健診・ストレスチェックの実施記録一覧（本人 or health_checkup:read:all）`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      "fiscal-year": z.string().optional(),
      "employee-id": z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const client = await createClient()

    const response = await client["health-checkup"]["health-checkups"].$get({
      query: {
        fiscal_year: query["fiscal-year"],
        employee_id: query["employee-id"],
      },
    })

    const rows = await response.json()

    return c.json(rows)
  },
)
