import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock certifications record-remove <id> — 資格保有記録を削除`

export default factory.createHandlers(
  zValidator("json", z.object({ help: z.string().optional() })),
  zValidator("param", z.object({ id: z.string().optional() })),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const id = c.req.valid("param").id

    if (!id) throw new UsageError("引数 <id> が必要です")

    const client = await createClient()

    const response = await client["employee-certifications"][":id"].$delete({
      param: { id: id },
    })

    return c.json({ status: response.status })
  },
)
