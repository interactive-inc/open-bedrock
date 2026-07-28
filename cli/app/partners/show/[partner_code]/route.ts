import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock partners show <code>`

export default factory.createHandlers(
  zValidator("json", z.object({ help: z.string().optional() })),
  zValidator("param", z.object({ partner_code: z.string().optional() })),
  async (c) => {
    if (c.req.valid("json").help) return c.text(help)

    const partnerCode = c.req.valid("param").partner_code

    if (!partnerCode) throw new UsageError("引数 <code> が必要です")

    const client = await createClient()

    const response = await client.partners[":code"].$get({
      param: { code: partnerCode },
    })

    return c.json(await response.json())
  },
)
