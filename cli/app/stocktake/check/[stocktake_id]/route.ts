import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `karte stocktake check <id> --asset-code <c> [--location-note <m>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      "asset-code": z.string().optional(),
      "location-note": z.string().optional(),
    }),
  ),
  zValidator("param", z.object({ stocktake_id: z.string().optional() })),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const stocktakeId = c.req.valid("param").stocktake_id

    if (!stocktakeId) throw new UsageError("引数 <id> が必要です")

    if (!query["asset-code"]) throw new UsageError("--asset-code が必要です")

    const client = await createClient()

    await client.stocktakes[":id"].assets[":code"].check.$post({
      param: { id: stocktakeId, code: query["asset-code"] },
      json: { location_note: query["location-note"] },
    })

    return c.text(`checked stocktake=${stocktakeId} asset=${query["asset-code"]}`)
  },
)
