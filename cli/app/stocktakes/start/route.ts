import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock stocktakes start --name <n> --target-date <d>`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      name: z.string().optional(),
      "target-date": z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query.name || !query["target-date"])
      throw new UsageError("--name と --target-date が必要です")

    const client = await createClient()

    const response = await client.stocktakes.$post({
      json: { name: query.name, target_date: query["target-date"] },
    })

    return c.json(await response.json())
  },
)
