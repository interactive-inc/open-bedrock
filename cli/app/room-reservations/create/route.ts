import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { toFiniteNumber } from "@/lib/to-finite-number"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock room-reservations create --room-id <n> --start <iso> --end <iso> [--purpose <p>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      "room-id": z.string().optional(),
      start: z.string().optional(),
      end: z.string().optional(),
      purpose: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query["room-id"] || !query.start || !query.end)
      throw new UsageError("--room-id, --start, --end が必要です")

    const client = await createClient()

    const response = await client["room"]["rooms"].reservations.$post({
      json: {
        room_id: toFiniteNumber(query["room-id"], "--room-id"),
        start_at: query.start,
        end_at: query.end,
        purpose: query.purpose ?? null,
      },
    })

    const reservation = await response.json()

    return c.json(reservation)
  },
)
