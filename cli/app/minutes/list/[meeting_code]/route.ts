import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock minutes list <meeting_code>`

export default factory.createHandlers(
  zValidator("json", z.object({ help: z.string().optional() })),
  zValidator("param", z.object({ meeting_code: z.string().optional() })),
  async (c) => {
    if (c.req.valid("json").help) return c.text(help)

    const code = c.req.valid("param").meeting_code

    if (!code) throw new UsageError("引数 <meeting_code> が必要です")

    const client = await createClient()

    const response = await client.meetings[":code"].minutes.$get({
      param: { code },
    })

    return c.json(await response.json())
  },
)
