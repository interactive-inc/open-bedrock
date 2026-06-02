import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `karte 1on1 delete --id <one-on-one-id> — 1on1 の記録を削除`

export default factory.createHandlers(
  zValidator("json", z.object({ help: z.string().optional(), id: z.string().optional() })),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query.id) throw new UsageError("--id が必要です")

    const client = await createClient()

    const response = await client.oneonone[":id"].$delete({
      param: { id: query.id },
    })

    if (response.status !== 204) {
      throw new UsageError("1on1 の削除に失敗しました")
    }

    return c.json({ id: query.id, status: "deleted" })
  },
)
