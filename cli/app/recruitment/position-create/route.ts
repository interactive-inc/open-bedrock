import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `karte recruitment position-create --title <t> [--department-code <c>] [--status open|closed] [--note <t>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      title: z.string().optional(),
      "department-code": z.string().optional(),
      status: z.enum(["open", "closed"]).optional(),
      note: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query.title) throw new UsageError("--title が必要です")

    const client = await createClient()

    const response = await client.recruitment.positions.$post({
      json: {
        title: query.title,
        department_code: query["department-code"] ?? null,
        status: query.status,
        note: query.note ?? null,
      },
    })

    return c.json(await response.json())
  },
)
