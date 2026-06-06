import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `karte thanks send --to <employee_code> --message <m>`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      to: z.string().optional(),
      message: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query.to || !query.message) throw new UsageError("--to と --message が必要です")

    const client = await createClient()

    const response = await client.thanks.$post({
      json: {
        recipient_employee_code: query.to,
        message: query.message,
      },
    })

    return c.json(await response.json())
  },
)
