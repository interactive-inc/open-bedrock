import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"
import { toFiniteNumber } from "@/lib/to-finite-number"

export const help = `bedrock contracts create --partner-id <id> --title <t> --contract-date <d> [--starts-on <d>] [--ends-on <d>] [--renewal-deadline <d>] [--note <t>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      "partner-id": z.string().optional(),
      title: z.string().optional(),
      "contract-date": z.string().optional(),
      "starts-on": z.string().optional(),
      "ends-on": z.string().optional(),
      "renewal-deadline": z.string().optional(),
      note: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query["partner-id"] || !query.title || !query["contract-date"])
      throw new UsageError("--partner-id と --title と --contract-date が必要です")

    const partnerId = toFiniteNumber(query["partner-id"], "--partner-id")

    const client = await createClient()

    const response = await client.contracts.$post({
      json: {
        partner_id: partnerId,
        title: query.title,
        contract_date: query["contract-date"],
        starts_on: query["starts-on"],
        ends_on: query["ends-on"],
        renewal_deadline: query["renewal-deadline"],
        note: query.note,
      },
    })

    return c.json(await response.json())
  },
)
