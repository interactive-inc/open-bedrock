import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock meetings update <code> --name <n> [--cadence <cd>] [--description <d>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      name: z.string().optional(),
      cadence: z.string().optional(),
      description: z.string().optional(),
    }),
  ),
  zValidator("param", z.object({ code: z.string().optional() })),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const code = c.req.valid("param").code

    if (!code) throw new UsageError("引数 <code> が必要です")

    if (!query.name) throw new UsageError("--name が必要です")

    const client = await createClient()

    const response = await client["meeting"]["meetings"][":code"].$put({
      param: { code },
      json: {
        name: query.name,
        cadence: query.cadence ?? null,
        description: query.description ?? null,
      },
    })

    return c.json(await response.json())
  },
)
