import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock knowledge-articles get <id>`

export default factory.createHandlers(
  zValidator("json", z.object({ help: z.string().optional() })),
  zValidator("param", z.object({ kid: z.string().optional() })),
  async (c) => {
    if (c.req.valid("json").help) return c.text(help)

    const kid = c.req.valid("param").kid

    if (!kid) throw new UsageError("引数 <id> が必要です")

    const client = await createClient()

    const response = await client["knowledge"]["knowledge-articles"][":id"].$get({
      param: { id: kid },
    })

    const article = await response.json()

    return c.text(
      [
        `== ${article.title} ==`,
        `category=${article.category} tags=${article.tags ?? ""}`,
        "",
        article.body_md,
      ].join("\n"),
    )
  },
)
