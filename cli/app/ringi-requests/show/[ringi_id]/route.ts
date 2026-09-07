import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock ringi-requests show <id>`
export default factory.createHandlers(
  zValidator("json", z.object({ help: z.string().optional() })),
  zValidator("param", z.object({ ringi_id: z.string().optional() })),
  async (c) => {
    if (c.req.valid("json").help) return c.text(help)
    const id = c.req.valid("param").ringi_id
    if (!id) throw new UsageError("引数 <id> が必要です")
    const client = await createClient()
    const response = await client.ringi["ringi-requests"][":id"].$get({ param: { id } })
    return c.json(await response.json())
  },
)
