import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock regulations register --code <c> --title <t> --body <md> --effective-on <d> [--category <c>] [--note <n>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      code: z.string().optional(),
      title: z.string().optional(),
      body: z.string().optional(),
      "effective-on": z.string().optional(),
      category: z.string().optional(),
      note: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query.code || !query.title || !query.body || !query["effective-on"]) {
      throw new UsageError("--code --title --body --effective-on が必要です")
    }

    const client = await createClient()

    const response = await client.regulations.$post({
      json: {
        code: query.code,
        title: query.title,
        body_md: query.body,
        effective_on: query["effective-on"],
        category: query.category,
        note: query.note,
      },
    })

    return c.json(await response.json())
  },
)
