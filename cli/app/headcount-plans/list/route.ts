import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"

export const help = `bedrock headcount-plans list [--fiscal-year <y>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({ help: z.string().optional(), "fiscal-year": z.string().optional() }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const client = await createClient()

    const response = await client["headcount-plans"].$get({
      query: query["fiscal-year"] ? { fiscal_year: query["fiscal-year"] } : {},
    })

    return c.json(await response.json())
  },
)
