import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `karte review cycle create --title <t> --period <p> [--due <d>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      title: z.string().optional(),
      period: z.string().optional(),
      due: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query.title || !query.period) throw new UsageError("--title と --period が必要です")

    const payload: { title: string; period: string; dueDate?: string } = {
      title: query.title,
      period: query.period,
    }

    if (query.due) payload.dueDate = query.due

    const client = await createClient()

    const response = await client["review-cycles"].$post({ json: payload })

    return c.json(await response.json())
  },
)
