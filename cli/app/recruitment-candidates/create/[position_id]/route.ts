import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock recruitment-candidates create <position_id> --name <n> [--email <e>] [--source <s>] [--note <t>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      name: z.string().optional(),
      email: z.string().optional(),
      source: z.string().optional(),
      note: z.string().optional(),
    }),
  ),
  zValidator("param", z.object({ position_id: z.string().optional() })),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const positionId = c.req.valid("param").position_id

    if (!positionId) throw new UsageError("引数 <position_id> が必要です")

    if (!query.name) throw new UsageError("--name が必要です")

    const client = await createClient()

    const response = await client["recruitment"]["job-openings"][":jobOpeningId"].candidates.$post({
      param: { jobOpeningId: positionId },
      json: {
        name: query.name,
        email: query.email ?? null,
        source: query.source ?? null,
        note: query.note ?? null,
      },
    })

    return c.json(await response.json())
  },
)
