import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock certificate-request update --id <id> --type <s> [--submit-to <s>] [--needed-by <date>] [--note <s>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      id: z.string().optional(),
      type: z.string().optional(),
      "submit-to": z.string().optional(),
      "needed-by": z.string().optional(),
      note: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query.id || !query.type) throw new UsageError("--id, --type が必要です")

    const client = await createClient()

    const response = await client["certificate-requests"][":id"].$put({
      param: { id: query.id },
      json: {
        certificate_type: query.type,
        submit_to: query["submit-to"] ?? null,
        needed_by: query["needed-by"] ?? null,
        note: query.note ?? null,
      },
    })

    const certificateRequest = await response.json()

    return c.json(certificateRequest)
  },
)
