import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock stocktake show <id>`

export default factory.createHandlers(
  zValidator("json", z.object({ help: z.string().optional() })),
  zValidator("param", z.object({ stocktake_id: z.string().optional() })),
  async (c) => {
    if (c.req.valid("json").help) return c.text(help)

    const stocktakeId = c.req.valid("param").stocktake_id

    if (!stocktakeId) throw new UsageError("引数 <id> が必要です")

    const client = await createClient()

    const response = await client.stocktakes[":id"].$get({
      param: { id: stocktakeId },
    })

    return c.json(await response.json())
  },
)
