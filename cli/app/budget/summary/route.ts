import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `karte budget summary --fiscal-period <p>`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      "fiscal-period": z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const fiscalPeriod = query["fiscal-period"]

    if (!fiscalPeriod) throw new UsageError("--fiscal-period が必要です")

    const client = await createClient()

    const response = await client.budgets.summary.$get({
      query: { fiscal_period: fiscalPeriod },
    })

    return c.json(await response.json())
  },
)
