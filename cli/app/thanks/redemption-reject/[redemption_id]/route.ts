import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `karte thanks redemption-reject <id> — 交換申請を却下（承認者向け）`

export default factory.createHandlers(
  zValidator("json", z.object({ help: z.string().optional() }).passthrough()),
  zValidator("param", z.object({ redemption_id: z.string().optional() })),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const redemptionId = c.req.valid("param").redemption_id

    if (!redemptionId) throw new UsageError("引数 <id> が必要です")

    const client = await createClient()

    const response = await client.thanks.redemptions[":id"].reject.$post({
      param: { id: redemptionId },
    })

    return c.json(await response.json())
  },
)
