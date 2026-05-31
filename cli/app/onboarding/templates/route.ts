import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"

export const help = `karte onboarding templates [--kind join|leave]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      kind: z.enum(["join", "leave"]).optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const client = await createClient()

    const response = await client.onboarding.templates.$get({
      query: { kind: query.kind },
    })

    const rows = await response.json()

    return c.json(rows)
  },
)
