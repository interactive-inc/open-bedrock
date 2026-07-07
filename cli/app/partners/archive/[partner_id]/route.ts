import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `karte partners archive <id>`

export default factory.createHandlers(
  zValidator("json", z.object({ help: z.string().optional() })),
  zValidator("param", z.object({ partner_id: z.string().optional() })),
  async (c) => {
    if (c.req.valid("json").help) return c.text(help)

    const partnerId = c.req.valid("param").partner_id

    if (!partnerId) throw new UsageError("引数 <id> が必要です")

    const client = await createClient()

    const response = await client.partners[":id"].archive.$post({
      param: { id: partnerId },
    })

    if (response.status !== 204) {
      throw new UsageError("取引先のアーカイブに失敗しました")
    }

    return c.json({ id: partnerId, status: "archived" })
  },
)
