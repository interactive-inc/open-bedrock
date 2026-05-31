import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"

export const help = `karte app mine [--status <s>]`

const json = () => zValidator("json", z.object({ help: z.string().optional() }).passthrough())

export default factory.createHandlers(json(), async (c) => {
  const query = c.req.valid("json")

  if (query.help) return c.text(help)

  const client = await createClient()

  const response = await client.applications.$get({
    query: { status: query.status as string | undefined },
  })

  const rows = await response.json()

  return c.json(rows)
})
