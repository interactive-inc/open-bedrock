import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock document-ledger-entries register --title <t> --location <l> [--category <c>] [--partner-code <p>] [--expires-on <d>] [--note <n>]`

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
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query.title || !query.location) throw new UsageError("--title と --location が必要です")

    const client = await createClient()

    const response = await client["document-ledger-entries"].$post({
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
