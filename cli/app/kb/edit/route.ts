import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock kb edit --id <id> --title <t> --category <c> --body <md> [--tags <a,b>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      id: z.string().optional(),
      title: z.string().optional(),
      category: z.string().optional(),
      body: z.string().optional(),
      tags: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query.id || !query.title || !query.category || !query.body)
      throw new UsageError("--id, --title, --category, --body が必要です")

    const client = await createClient()

    const response = await client.knowledge[":id"].$put({
      param: { id: query.id },
      json: {
        title: query.title,
        category: query.category,
        body_md: query.body,
        tags: query.tags ?? null,
      },
    })

    const article = await response.json()

    return c.json(article)
  },
)
