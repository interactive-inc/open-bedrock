import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { toFiniteNumber } from "@/lib/to-finite-number"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock grade-definitions create --code <c> --name <n> --rank <r> [--description <d>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      code: z.string().optional(),
      name: z.string().optional(),
      rank: z.string().optional(),
      description: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query.code || !query.name || !query.rank)
      throw new UsageError("--code, --name, --rank が必要です")

    const client = await createClient()

    const response = await client.company["grade-definitions"].$post({
      json: {
        code: query.code,
        name: query.name,
        rank: toFiniteNumber(query.rank, "--rank"),
        description: query.description,
      },
    })

    const data = await response.json()

    return c.json(data)
  },
)
