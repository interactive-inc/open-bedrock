import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock knowledge-articles add --title <t> --category <c> --body <md> [--tags <a,b>] --reason <text> --idempotency-key <uuid>`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      reason: z.string().trim().min(1).max(2000).optional(),
      "idempotency-key": z.string().uuid().optional(),

      title: z.string().optional(),
      category: z.string().optional(),
      body: z.string().optional(),
      tags: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query.title || !query.category || !query.body)
      throw new UsageError("--title, --category, --body が必要です")

    if (!query.reason || !query["idempotency-key"])
      return c.json({ error: "--reason, --idempotency-key が必要です" }, 400)

    const client = await createClient()

    const response = await client["knowledge"]["knowledge-articles"].$post({
      header: { "idempotency-key": query["idempotency-key"] },
      json: {
        reason: query.reason,
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
