import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock one-on-ones show --id <one-on-one-id> — 1on1 を1件表示`

export default factory.createHandlers(
  zValidator("json", z.object({ help: z.string().optional(), id: z.string().optional() })),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query.id) throw new UsageError("--id が必要です")

    const client = await createClient()

    const response = await client["one-on-one"]["one-on-ones"][":id"].$get({
      param: { id: query.id },
    })

    const oneOnOne = await response.json()

    return c.json(oneOnOne)
  },
)
