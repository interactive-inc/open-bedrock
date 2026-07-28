import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock thanks-redemptions create --reward <id> — 受領残高から交換を申請`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      reward: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query.reward) throw new UsageError("--reward <id> が必要です")

    const rewardId = Number(query.reward)

    if (Number.isInteger(rewardId) === false || rewardId <= 0) {
      throw new UsageError("--reward は正の整数で指定してください")
    }

    const client = await createClient()

    const response = await client["thanks-redemptions"].$post({
      json: { reward_id: rewardId },
    })

    return c.json(await response.json())
  },
)
