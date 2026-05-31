import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `karte career apply <id> [--message <m>]`

export default factory.createHandlers(
  zValidator("json", z.object({ help: z.string().optional(), message: z.string().optional() })),
  zValidator("param", z.object({ posting_id: z.string().optional() })),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const postingId = c.req.valid("param").posting_id

    if (!postingId) throw new UsageError("引数 <id> が必要です")

    const client = await createClient()

    const response = await client.career.postings[":posting_id"].apply.$post({
      param: { posting_id: postingId },
      json: { message: query.message ?? null },
    })

    const result = await response.json()

    return c.json(result)
  },
)
