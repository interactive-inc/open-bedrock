import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `karte regulations add-version <code> --body <md> --effective-on <d> [--note <n>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      body: z.string().optional(),
      "effective-on": z.string().optional(),
      note: z.string().optional(),
    }),
  ),
  zValidator("param", z.object({ regulation_code: z.string().optional() })),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const regulationCode = c.req.valid("param").regulation_code

    if (!regulationCode) throw new UsageError("引数 <code> が必要です")

    if (!query.body || !query["effective-on"]) {
      throw new UsageError("--body と --effective-on が必要です")
    }

    const client = await createClient()

    const response = await client.regulations[":code"].versions.$post({
      param: { code: regulationCode },
      json: {
        body_md: query.body,
        effective_on: query["effective-on"],
        note: query.note,
      },
    })

    return c.json(await response.json())
  },
)
