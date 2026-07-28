import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { factory } from "@/factory"
import { api } from "@/lib/http/client"

export const help = `bedrock governance-org-roles list`

export default factory.createHandlers(
  zValidator("json", z.object({ help: z.string().optional() })),
  async (c) => {
    if (c.req.valid("json").help) return c.text(help)
    return c.json(await api("/governance-org-roles"))
  },
)
