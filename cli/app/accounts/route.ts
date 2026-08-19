import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { UsageError } from "@/lib/errors"
import { factory } from "@/factory"

export const help = `bedrock accounts — アカウント一覧（account:manage が必要）

usage:
  bedrock accounts`

export default factory.createHandlers(
  zValidator("json", z.object({ help: z.string().optional() })),
  async (c) => {
    if (c.req.valid("json").help) return c.text(help)

    const client = await createClient()

    const response = await client.system.v1.accounts.$get()
    if (response.status !== 200) throw new UsageError("アカウント一覧の取得に失敗しました")

    const body = await response.json()

    return c.json(body)
  },
)
