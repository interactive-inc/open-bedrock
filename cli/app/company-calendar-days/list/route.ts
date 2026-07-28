import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"

export const help = `bedrock company-calendar-days list [--year <YYYY>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      year: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const client = await createClient()

    const response = await client["company-calendar-days"].$get({
      query: { year: query.year },
    })

    return c.json(await response.json())
  },
)
