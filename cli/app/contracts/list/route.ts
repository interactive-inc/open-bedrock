import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"

export const help = `bedrock contracts list [--partner-id <id>] [--order renewal_near|contract_date_desc|contract_date_asc]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      "partner-id": z.string().optional(),
      order: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const client = await createClient()

    const response = await client.contracts.$get({
      query: { partner_id: query["partner-id"], order: query.order },
    })

    return c.json(await response.json())
  },
)
