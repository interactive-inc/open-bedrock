import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock onboarding template-update --code <c> --name <n> --kind <join|leave> [--description <d>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      code: z.string().optional(),
      name: z.string().optional(),
      kind: z.enum(["join", "leave"]).optional(),
      description: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query.code || !query.name || !query.kind) {
      throw new UsageError("--code と --name と --kind が必要です")
    }

    const client = await createClient()

    const response = await client.onboarding.templates[":code"].$put({
      param: { code: query.code },
      json: {
        name: query.name,
        kind: query.kind,
        description: query.description ?? null,
      },
    })

    const template = await response.json()

    return c.json(template)
  },
)
