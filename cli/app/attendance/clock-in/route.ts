import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { pretty } from "@/lib/render/table"
import { factory } from "@/factory"

export const help = `karte attendance clock-in [--note <n>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      note: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const json: { note: string | null } = { note: query.note ?? null }

    const client = await createClient()

    const response = await client.attendance["clock-in"].$post({ json })

    return c.text(pretty(await response.json()))
  },
)
