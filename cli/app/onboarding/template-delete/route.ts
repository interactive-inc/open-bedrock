import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `karte onboarding template-delete --code <code> — オンボーディングテンプレートを削除`

export default factory.createHandlers(
  zValidator("json", z.object({ help: z.string().optional(), code: z.string().optional() })),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query.code) throw new UsageError("--code が必要です")

    const client = await createClient()

    const response = await client.onboarding.templates[":code"].$delete({
      param: { code: query.code },
    })

    if (response.status !== 204) {
      throw new UsageError("テンプレートの削除に失敗しました")
    }

    return c.json({ code: query.code, status: "deleted" })
  },
)
