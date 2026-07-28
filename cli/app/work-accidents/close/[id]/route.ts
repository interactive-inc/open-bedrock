import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock work-accidents close <id> — 発生記録を closed にする`

export default factory.createHandlers(
  zValidator("json", z.object({ help: z.string().optional() })),
  zValidator("param", z.object({ id: z.string().optional() })),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const id = c.req.valid("param").id

    if (!id) throw new UsageError("引数 <id> が必要です")

    const client = await createClient()

    const response = await client["work-accidents"][":id"].close.$post({
      param: { id: id },
    })

    const record = await response.json()

    return c.json(record)
  },
)
