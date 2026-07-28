import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock partners register --code <c> --name <n> [--category customer|supplier|other] [--corporate-number <cn>] [--note <t>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      code: z.string().optional(),
      name: z.string().optional(),
      category: z.enum(["customer", "supplier", "other"]).optional(),
      "corporate-number": z.string().optional(),
      note: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query.code || !query.name) throw new UsageError("--code と --name が必要です")

    const client = await createClient()

    const response = await client.partners.$post({
      json: {
        code: query.code,
        name: query.name,
        category: query.category,
        corporate_number: query["corporate-number"],
        note: query.note,
      },
    })

    return c.json(await response.json())
  },
)
