import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock career sheet-delete — 自分のキャリアシートを削除`

export default factory.createHandlers(
  zValidator("json", z.object({ help: z.string().optional() })),
  async (c) => {
    if (c.req.valid("json").help) return c.text(help)

    const client = await createClient()

    const response = await client.career.sheet.me.$delete()

    if (response.status !== 204) {
      throw new UsageError("キャリアシートの削除に失敗しました")
    }

    return c.json({ status: "cleared" })
  },
)
