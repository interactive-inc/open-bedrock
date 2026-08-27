import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock antisocial-checks request --partner <s> [--address <s>] [--representative <s>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      partner: z.string().optional(),
      address: z.string().optional(),
      representative: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query.partner) throw new UsageError("--partner が必要です")

    const client = await createClient()

    const response = await client["antisocial-check"]["antisocial-checks"].$post({
      json: {
        partner_name: query.partner,
        partner_address: query.address ?? null,
        representative_name: query.representative ?? null,
      },
    })

    const antisocialCheck = await response.json()

    return c.json(antisocialCheck)
  },
)
