import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock certification-definitions update <id> --name <n> [--issuer <i>] [--description <d>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      name: z.string().optional(),
      issuer: z.string().optional(),
      description: z.string().optional(),
    }),
  ),
  zValidator("param", z.object({ id: z.string().optional() })),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const id = c.req.valid("param").id

    if (!id) throw new UsageError("引数 <id> が必要です")

    if (!query.name) throw new UsageError("--name が必要です")

    const client = await createClient()

    const response = await client["certification-definitions"][":id"].$put({
      param: { id: id },
      json: {
        name: query.name,
        issuer: query.issuer ?? null,
        description: query.description ?? null,
      },
    })

    const certification = await response.json()

    return c.json(certification)
  },
)
