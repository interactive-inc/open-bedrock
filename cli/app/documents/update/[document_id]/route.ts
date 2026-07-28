import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock documents update <id> --title <t> --location <l> [--category <c>] [--partner-code <p>] [--expires-on <d>] [--note <n>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      title: z.string().optional(),
      location: z.string().optional(),
      category: z.string().optional(),
      "partner-code": z.string().optional(),
      "expires-on": z.string().optional(),
      note: z.string().optional(),
    }),
  ),
  zValidator("param", z.object({ document_id: z.string().optional() })),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const documentId = c.req.valid("param").document_id

    if (!documentId) throw new UsageError("引数 <id> が必要です")

    if (!query.title || !query.location) throw new UsageError("--title と --location が必要です")

    const client = await createClient()

    const response = await client.documents[":id"].$put({
      param: { id: documentId },
      json: {
        title: query.title,
        location: query.location,
        category: query.category,
        partner_code: query["partner-code"],
        expires_on: query["expires-on"],
        note: query.note,
      },
    })

    return c.json(await response.json())
  },
)
