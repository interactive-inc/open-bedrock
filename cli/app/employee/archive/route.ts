import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"
import { createClient } from "@/lib/http/hc-client"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

export const help = `karte employee archive --code <code>`

export default factory.createHandlers(
  zValidator("json", z.object({ help: z.string().optional(), code: z.string().optional() })),
  async (c) => {
    const input = c.req.valid("json")
    if (input.help) return c.text(help)
    if (!input.code) throw new UsageError("--code が必要です")
    const client = await createClient()
    const response = await client.employees[":code"].archive.$post({
      param: { code: input.code },
    })
    return c.json(await response.json())
  },
)
