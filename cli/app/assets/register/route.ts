import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock assets register --code <c> --name <n> --kind pc|monitor|furniture|other [--serial <s>] [--purchased-on <d>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      code: z.string().optional(),
      name: z.string().optional(),
      kind: z.enum(["pc", "monitor", "furniture", "other"]).optional(),
      serial: z.string().optional(),
      "purchased-on": z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query.code || !query.name || !query.kind)
      throw new UsageError("--code と --name と --kind が必要です")

    const client = await createClient()

    const response = await client["asset"]["assets"].$post({
      json: {
        code: query.code,
        name: query.name,
        kind: query.kind,
        serial: query.serial,
        purchased_on: query["purchased-on"],
      },
    })

    return c.json(await response.json())
  },
)
