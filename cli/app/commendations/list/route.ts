import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"

export const help = `bedrock commendations list [--employee-id <id>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({ help: z.string().optional(), "employee-id": z.string().optional() }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const client = await createClient()

    const response = await client.commendations.$get({
      query: query["employee-id"] ? { employee_id: query["employee-id"] } : {},
    })

    return c.json(await response.json())
  },
)
