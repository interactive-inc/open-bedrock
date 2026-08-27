import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"

export const help = `bedrock certification-definitions records [--employee-id <id>] — 資格保有記録一覧（本人 or certification:read:all）`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({ help: z.string().optional(), "employee-id": z.string().optional() }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const client = await createClient()

    const response = await client["certification"]["employee-certifications"].$get({
      query: { employee_id: query["employee-id"] },
    })

    const rows = await response.json()

    return c.json(rows)
  },
)
