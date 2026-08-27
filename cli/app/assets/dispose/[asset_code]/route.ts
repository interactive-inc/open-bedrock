import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock assets dispose <code> --reason <r> [--disposed-on <d>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      reason: z.string().optional(),
      "disposed-on": z.string().optional(),
    }),
  ),
  zValidator("param", z.object({ asset_code: z.string().optional() })),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const assetCode = c.req.valid("param").asset_code

    if (!assetCode) throw new UsageError("引数 <code> が必要です")

    if (!query.reason) throw new UsageError("--reason が必要です")

    const client = await createClient()

    const response = await client["asset"]["assets"][":code"].dispose.$post({
      param: { code: assetCode },
      json: { reason: query.reason, disposed_on: query["disposed-on"] },
    })

    return c.json(await response.json())
  },
)
