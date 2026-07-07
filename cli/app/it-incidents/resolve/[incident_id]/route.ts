import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `karte it-incidents resolve <id>`

export default factory.createHandlers(
  zValidator("json", z.object({ help: z.string().optional() })),
  zValidator("param", z.object({ incident_id: z.string().optional() })),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const incidentId = c.req.valid("param").incident_id

    if (!incidentId) throw new UsageError("引数 <id> が必要です")

    const client = await createClient()

    const response = await client["it-incidents"][":id"].resolve.$post({
      param: { id: incidentId },
    })

    return c.json(await response.json())
  },
)
