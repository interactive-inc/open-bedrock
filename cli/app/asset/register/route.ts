import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { pretty } from "@/lib/render/table"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `karte asset register --code <c> --name <n> --kind pc|monitor|furniture|other [--serial <s>] [--purchased-on <d>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      code: z.string().optional(),
      name: z.string().optional(),
      kind: z.string().optional(),
      serial: z.string().optional(),
      "purchased-on": z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query.code || !query.name || !query.kind)
      throw new UsageError("--code と --name と --kind が必要です")

    const payload: Record<string, unknown> = {
      code: query.code,
      name: query.name,
      kind: query.kind,
    }

    if (query.serial) payload.serial = query.serial

    if (query["purchased-on"]) payload.purchased_on = query["purchased-on"]

    const client = await createClient()

    const response = await client.assets.$post({ json: payload })

    return c.text(pretty(await response.json()))
  },
)
