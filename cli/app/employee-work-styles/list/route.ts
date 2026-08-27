import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"

export const help = `bedrock employee-work-styles list [--employee-id <id>]   (employee-id は数値の社員 ID)`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      "employee-id": z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const client = await createClient()

    const response = await client["work-style"]["employee-work-styles"].$get({
      query: { employee_id: query["employee-id"] },
    })

    return c.json(await response.json())
  },
)
