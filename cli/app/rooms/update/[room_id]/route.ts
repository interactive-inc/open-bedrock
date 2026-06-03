import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `karte rooms update <room_id> --name <n> --capacity <c> [--location <l>]`

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
  zValidator("param", z.object({ room_id: z.string().optional() })),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const roomId = c.req.valid("param").room_id

    if (!roomId) throw new UsageError("引数 <room_id> が必要です")

    if (!query.name || !query.capacity) throw new UsageError("--name と --capacity が必要です")

    const capacity = Number(query.capacity)

    if (!Number.isInteger(capacity) || capacity <= 0)
      throw new UsageError("--capacity は正の整数で指定してください")

    const client = await createClient()

    const response = await client.rooms[":id"].$put({
      param: { id: roomId },
      json: { name: query.name, capacity: capacity, location: query.location ?? null },
    })

    return c.json(await response.json())
  },
)
