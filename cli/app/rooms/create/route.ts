import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock rooms create --name <n> --capacity <c> [--location <l>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      name: z.string().optional(),
      capacity: z.string().optional(),
      location: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query.name || !query.capacity) throw new UsageError("--name と --capacity が必要です")

    const capacity = Number(query.capacity)

    if (!Number.isInteger(capacity) || capacity <= 0)
      throw new UsageError("--capacity は正の整数で指定してください")

    const client = await createClient()

    const response = await client["room"]["rooms"].$post({
      json: { name: query.name, capacity: capacity, location: query.location ?? null },
    })

    return c.json(await response.json())
  },
)
