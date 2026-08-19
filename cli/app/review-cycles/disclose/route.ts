import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock review-cycles disclose --cycle-id <cycle-id>   サイクル内の全フォームを一括開示（管理者）`

export default factory.createHandlers(
  zValidator("json", z.object({ help: z.string().optional(), "cycle-id": z.string().optional() })),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query["cycle-id"]) throw new UsageError("--cycle-id が必要です")

    const client = await createClient()

    const response = await client["review-cycles"][":cycleId"].disclose.$post({
      param: { cycleId: query["cycle-id"] },
    })

    return c.json(await response.json())
  },
)
