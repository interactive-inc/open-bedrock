import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock certification-definitions create --code <c> --name <n> [--issuer <i>] [--description <d>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      code: z.string().optional(),
      name: z.string().optional(),
      issuer: z.string().optional(),
      description: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query.code || !query.name) throw new UsageError("--code と --name が必要です")

    const client = await createClient()

    const response = await client["certification"]["certification-definitions"].$post({
      json: {
        code: query.code,
        name: query.name,
        issuer: query.issuer ?? null,
        description: query.description ?? null,
      },
    })

    const certification = await response.json()

    return c.json(certification)
  },
)
