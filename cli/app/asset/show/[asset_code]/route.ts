import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { pretty } from "@/lib/render/table"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `karte asset show <code>`

export default factory.createHandlers(
  zValidator("json", z.object({ help: z.string().optional() })),
  zValidator("param", z.object({ asset_code: z.string().optional() })),
  async (c) => {
    if (c.req.valid("json").help) return c.text(help)

    const assetCode = c.req.valid("param").asset_code

    if (!assetCode) throw new UsageError("引数 <code> が必要です")

    const client = await createClient()

    const response = await client.assets[":code"].$get({
      param: { code: assetCode },
    })

    return c.text(pretty(await response.json()))
  },
)
