import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock contracts update <id> --title <t> --contract-date <d> [--starts-on <d>] [--ends-on <d>] [--renewal-deadline <d>] [--note <t>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      title: z.string().optional(),
      "contract-date": z.string().optional(),
      "starts-on": z.string().optional(),
      "ends-on": z.string().optional(),
      "renewal-deadline": z.string().optional(),
      note: z.string().optional(),
    }),
  ),
  zValidator("param", z.object({ contract_id: z.string().optional() })),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const contractId = c.req.valid("param").contract_id

    if (!contractId) throw new UsageError("引数 <id> が必要です")

    if (!query.title || !query["contract-date"])
      throw new UsageError("--title と --contract-date が必要です")

    const client = await createClient()

    const response = await client.contracts[":id"].$put({
      param: { id: contractId },
      json: {
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
