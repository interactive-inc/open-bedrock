import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock regulations show <code>`

export default factory.createHandlers(
  zValidator("json", z.object({ help: z.string().optional() })),
  zValidator("param", z.object({ regulation_code: z.string().optional() })),
  async (c) => {
    if (c.req.valid("json").help) return c.text(help)

    const regulationCode = c.req.valid("param").regulation_code

    if (!regulationCode) throw new UsageError("引数 <code> が必要です")

    const client = await createClient()

    const response = await client.regulations[":code"].$get({
      param: { code: regulationCode },
    })

    return c.json(await response.json())
  },
)
