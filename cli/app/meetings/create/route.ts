import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock meetings create --code <c> --name <n> [--cadence <cd>] [--description <d>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      code: z.string().optional(),
      name: z.string().optional(),
      cadence: z.string().optional(),
      description: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query.code || !query.name) throw new UsageError("--code と --name が必要です")

    const client = await createClient()

    const response = await client.meetings.$post({
      json: {
        code: query.code,
        name: query.name,
        cadence: query.cadence ?? null,
        description: query.description ?? null,
      },
    })

    return c.json(await response.json())
  },
)
