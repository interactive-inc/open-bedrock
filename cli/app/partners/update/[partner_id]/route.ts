import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock partners update <id> --name <n> [--category customer|supplier|other] [--corporate-number <cn>] [--note <t>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      name: z.string().optional(),
      category: z.enum(["customer", "supplier", "other"]).optional(),
      "corporate-number": z.string().optional(),
      note: z.string().optional(),
    }),
  ),
  zValidator("param", z.object({ partner_id: z.string().optional() })),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const partnerId = c.req.valid("param").partner_id

    if (!partnerId) throw new UsageError("引数 <id> が必要です")

    if (!query.name) throw new UsageError("--name が必要です")

    const client = await createClient()

    const response = await client["partner"]["partners"][":id"].$put({
      param: { id: partnerId },
      json: {
        name: query.name,
        category: query.category,
        corporate_number: query["corporate-number"],
        note: query.note,
      },
    })

    return c.json(await response.json())
  },
)
