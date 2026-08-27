import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock decision-records supersede <id> --by <new_id>`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      by: z.string().optional(),
    }),
  ),
  zValidator("param", z.object({ id: z.string().optional() })),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const id = c.req.valid("param").id

    if (!id) throw new UsageError("引数 <id> が必要です")

    if (!query.by) throw new UsageError("--by <new_id> が必要です")

    const supersededById = Number(query.by)

    if (!Number.isInteger(supersededById) || supersededById <= 0)
      throw new UsageError("--by は正の整数で指定してください")

    const client = await createClient()

    const response = await client["meeting"]["decision-records"][":id"].supersede.$post({
      param: { id },
      json: { superseded_by_id: supersededById },
    })

    return c.json(await response.json())
  },
)
