import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"

export const help = `bedrock work-accidents [--status <s>] [--employee-id <id>] — 労災・事故の発生記録一覧（work_accident:read:all）`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      status: z.string().optional(),
      "employee-id": z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const client = await createClient()

    const response = await client["work-accidents"].$get({
      query: { status: query.status, employee_id: query["employee-id"] },
    })

    const rows = await response.json()

    return c.json(rows)
  },
)
