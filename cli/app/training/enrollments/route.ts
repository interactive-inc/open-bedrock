import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"

export const help = `karte training enrollments [--employee-code <c>] — 受講一覧（管理者で他者指定可）`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({ help: z.string().optional(), "employee-code": z.string().optional() }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const client = await createClient()

    const response = await client.training.enrollments.$get({
      query: { employee_code: query["employee-code"] },
    })

    const rows = await response.json()

    return c.json(rows)
  },
)
