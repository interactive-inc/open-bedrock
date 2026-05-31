import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `karte 1on1 create --member-email <e> [--topics <t>] [--manager-note <n>] [--next-action <a>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      "member-email": z.string().optional(),
      topics: z.string().optional(),
      "manager-note": z.string().optional(),
      "next-action": z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query["member-email"]) throw new UsageError("--member-email が必要です")

    const json: {
      member_email: string
      topics?: string
      manager_note?: string
      next_action?: string
    } = { member_email: query["member-email"] }

    if (query.topics) json.topics = query.topics

    if (query["manager-note"]) json.manager_note = query["manager-note"]

    if (query["next-action"]) json.next_action = query["next-action"]

    const client = await createClient()

    const response = await client.oneonone.$post({ json })

    return c.json(await response.json())
  },
)
