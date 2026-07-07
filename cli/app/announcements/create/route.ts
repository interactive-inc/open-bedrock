import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `karte announcements create --title <t> --body <md>`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      title: z.string().optional(),
      body: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query.title || !query.body) throw new UsageError("--title と --body が必要です")

    const client = await createClient()

    const response = await client.announcements.$post({
      json: { title: query.title, body_md: query.body },
    })

    return c.json(await response.json())
  },
)
