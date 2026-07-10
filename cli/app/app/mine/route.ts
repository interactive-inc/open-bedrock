import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"

export const help = `karte app mine [--status pending|approved|rejected]`

const json = () =>
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      status: z.enum(["pending", "approved", "rejected"]).optional(),
    }),
  )

export default factory.createHandlers(json(), async (c) => {
  const query = c.req.valid("json")

  if (query.help) return c.text(help)

  const client = await createClient()

  const response = await client.applications.$get({
    query: { status: query.status },
  })

  const rows = await response.json()

  return c.json(rows)
})
