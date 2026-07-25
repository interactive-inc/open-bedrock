import { factory } from "@/factory"
import { createClient } from "@/lib/http/hc-client"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

export const help = `bedrock batch employee-lifecycle rebuild-projections`
export default factory.createHandlers(
  zValidator("json", z.object({ help: z.string().optional() })),
  async (c) => {
    if (c.req.valid("json").help) return c.text(help)
    const client = await createClient()
    const response = await client.batch["employee-lifecycle"]["rebuild-projections"].$post()
    return c.json(await response.json())
  },
)
