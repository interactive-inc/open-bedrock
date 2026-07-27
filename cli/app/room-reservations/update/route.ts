import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock room-reservations update --id <reservation-id> --start <iso> --end <iso> [--purpose <p>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      id: z.string().optional(),
      start: z.string().optional(),
      end: z.string().optional(),
      purpose: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query.id || !query.start || !query.end)
      throw new UsageError("--id, --start, --end が必要です")

    const client = await createClient()

    const response = await client.rooms.reservations[":id"].$put({
      param: { id: query.id },
      json: {
        start_at: query.start,
        end_at: query.end,
        purpose: query.purpose ?? null,
      },
    })

    const reservation = await response.json()

    return c.json(reservation)
  },
)
